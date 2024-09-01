import { Project, User } from '@prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../data/prisma.js';
import { IconSet } from '@iconify/tools';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { fileExists } from '../../misc/files.js';
import { triggerIconSetsUpdate } from '../../data/icon-sets.js';
import z from 'zod';
import { IconifyJSON } from '@iconify/types';
import { writeIconSet } from '../../data/custom-icon.js';
import { createAPIv2CollectionResponse } from './collection-v2.js';
import { APIv2CollectionResponse } from '../../types/server/v2.js';

export type AddUserToProjectBody = {
	projectId: string;
	userId: string;
};
export async function handleAddUserToProject(req: FastifyRequest, res: FastifyReply) {
	try {
		const query = req.query as AddUserToProjectBody;
		const v = z.object({
			projectId: z.string().transform((v) => parseInt(v)),
			userId: z.string().transform((v) => parseInt(v)),
		});
		const r = v.parse(query);

		await prisma.projectMember.create({
			data: { projectId: +r.projectId, userId: +r.userId, role: 0 },
		});
		res.send({ code: 200 });
	} catch (error) {
		res.send({ code: 400, error });
	}
}

export async function handleAddIcons(req: FastifyRequest, res: FastifyReply) {
	try {
		const v = z.object({
			projectId: z.number(),
			// icon data
			icons: z.record(
				z.object({
					body: z.string(),
					// view box values
					left: z.number().optional(),
					top: z.number().optional(),
					width: z.number(),
					height: z.number(),
					// transform
					hFlip: z.boolean().optional(),
					vFlip: z.boolean().optional(),
				})
			),
		});
		const { projectId, icons } = v.parse(req.body);
		const project = await prisma.project.findUnique({ where: { id: projectId } });
		if (!project) {
			return res.send({ code: 400, error: 'project is not found' });
		}
		// load icon set from db
		const iconSet = new IconSet(JSON.parse(project?.projectIconSetJSON as string) as IconifyJSON);
		// add icons to icon set
		for (const iconName in icons) {
			if (iconSet.exists(iconName)) {
				continue;
			}
			iconSet.setIcon(iconName, icons[iconName]);
		}
		// update to db and icons dir
		const newIconSetJSON = JSON.stringify(iconSet.export(true));
		await writeIconSet(project.prefix, newIconSetJSON);
		await prisma.project.update({
			where: { id: projectId },
			data: { projectIconSetJSON: newIconSetJSON },
		});
		// update iconset data
		await triggerIconSetsUpdate(1);
		res.send({ code: 200 });
	} catch (error) {
		res.send({ code: 400, error });
	}
}

export type MemberInfoQuery = {
	projectId: number;
};
export async function handleMemberInfo(req: FastifyRequest<{ Querystring: MemberInfoQuery }>, res: FastifyReply) {
	if (!req.query.projectId) {
		return res.send({ code: 400, error: 'project id is required' });
	}
	try {
		const reqUser = req.user as User;
		const member = await prisma.projectMember.findMany({
			where: { userId: reqUser.id, projectId: req.query.projectId },
		});
		res.send({ code: 200, data: member });
	} catch (error) {
		return res.send({ code: 400, error });
	}
}

export type MembersInfoQuery = {
	projectId: string;
};
export async function handleMemberList(req: FastifyRequest, res: FastifyReply) {
	const query = req.query as MembersInfoQuery;
	if (!query.projectId) {
		return res.send({ code: 400, error: 'project id is required' });
	}
	try {
		const pid = parseInt(query.projectId, 10);
		const members = await prisma.projectMember.findMany({
			where: { projectId: { equals: pid } },
			include: { user: { select: { name: true } } },
		});
		res.send({ code: 200, data: members });
	} catch (error) {
		console.log(error);
		return res.send({ code: 400, error });
	}
}

export type CreateProjectBody = {
	prefix: string;
	name: string;
	desc: string;
};
export async function handleCreateProject(req: FastifyRequest, res: FastifyReply) {
	const reqUser = req.user as User;
	try {
		const { prefix, name, desc } = req.body as CreateProjectBody;
		const iconset = new IconSet({
			prefix,
			info: {
				name,
				total: 0,
				version: '0.0.1',
				author: {
					name: reqUser.name,
					url: '/',
				},
				license: { title: 'MIT', spdx: 'MIT' },
				samples: [],
				height: 24,
				displayHeight: 24,
				palette: false,
				category: 'PROJECT',
			},
			icons: {},
		});

		const iconJson = iconset.export(true);
		const iconSetPath = path.join(`icons/${prefix}.json`);
		if (await fileExists(iconSetPath)) {
			return res.send({ code: 400, message: `${prefix} iconset existed` });
		}
		await fs.writeFile(iconSetPath, JSON.stringify(iconJson, null, 2));
		// update custom icon
		await triggerIconSetsUpdate(1);

		// create project record for db
		await prisma.project.create({
			data: {
				prefix,
				name,
				desc,
				projectIconSetJSON: JSON.stringify(iconJson),
				projectMember: {
					create: {
						userId: reqUser.id,
						role: 1,
					},
				},
			},
		});

		res.send({ code: 200, data: iconJson });
	} catch (error) {
		res.send({ code: 400, error });
	}
}

export async function queryAllProejcts(req: FastifyRequest, res: FastifyReply) {
	const reqUser = req.user as User;
	try {
		const projects = await prisma.project.findMany({
			where: {
				projectMember: {
					some: {
						userId: reqUser.id,
					},
				},
			},
			select: { id: true, name: true, prefix: true, desc: true, total: true },
		});
		res.send({ code: 200, data: projects });
	} catch (error) {
		res.send({ code: 400, error });
	}
}

export type ProjectInfoQuery = {
	prefix: string;
};
export async function queryProjectInfo(req: FastifyRequest, res: FastifyReply) {
	const query = req.query as ProjectInfoQuery;
	const record = await prisma.project.findUnique({
		where: { prefix: query.prefix },
		select: {
			id: true,
			name: true,
			prefix: true,
			desc: true,
			total: true,
		},
	});
	const iconSet = createAPIv2CollectionResponse({ prefix: query.prefix });
	if (iconSet === 404) {
		return res.send({ code: 400, error: 'iconset returned 404' });
	}
	res.send({ code: 200, data: { ...record, ...((iconSet || {}) as APIv2CollectionResponse) } });
}
