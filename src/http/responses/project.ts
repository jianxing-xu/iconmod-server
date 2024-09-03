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

export async function handleAddUserToProject(req: FastifyRequest, res: FastifyReply) {
	try {
		const query = z.object({ projectId: z.number(), userId: z.number() }).parse(req.body);

		await prisma.projectMember.create({
			data: { projectId: query.projectId, userId: query.userId, role: 0 },
		});
		res.header('cache-control', 'no-cache');
		res.send({ code: 200 });
	} catch (error) {
		res.send({ code: 400, error });
	}
}
export async function handleDeleteUserOfProject(req: FastifyRequest, res: FastifyReply) {
	try {
		const query = z.object({ projectId: z.number(), userId: z.number() }).parse(req.body);

		await prisma.projectMember.deleteMany({ where: { userId: query.userId, projectId: query.projectId } });
		res.header('cache-control', 'no-cache');
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
		res.header('cache-control', 'no-cache');
		res.send({ code: 200 });
	} catch (error) {
		res.send({ code: 400, error });
	}
}

export async function handleMemberInfo(req: FastifyRequest, res: FastifyReply) {
	try {
		const query = z.object({ projectId: z.string().transform((v) => parseInt(v)) }).parse(req.query);
		const reqUser = req.user as User;
		const member = await prisma.projectMember.findMany({
			where: { userId: reqUser.id, projectId: query.projectId },
		});
		res.header('cache-control', 'no-cache');
		res.send({ code: 200, data: member });
	} catch (error) {
		return res.send({ code: 400, error });
	}
}

export async function handleMemberList(req: FastifyRequest, res: FastifyReply) {
	try {
		const query = z.object({ projectId: z.string().transform((v) => parseInt(v)) }).parse(req.query);
		if (!query.projectId) {
			return res.send({ code: 400, error: 'project id is required' });
		}
		const members = await prisma.projectMember.findMany({
			where: { projectId: { equals: query.projectId } },
			include: { user: { select: { name: true } } },
		});
		res.header('cache-control', 'no-cache');
		res.send({ code: 200, data: members });
	} catch (error) {
		console.log(error);
		return res.send({ code: 400, error });
	}
}

export async function handleCreateProject(req: FastifyRequest, res: FastifyReply) {
	const reqUser = req.user as User;
	try {
		const v = z.object({
			prefix: z.string(),
			name: z.string(),
			desc: z.string().default(''),
			userIds: z.array(z.number()),
			logo: z.string().default(''),
		});
		const { prefix, name, desc, userIds, logo } = v.parse(req.body);
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
			width: 24,
			height: 24,
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
				logo,
				projectMember: {
					createMany: {
						data: [
							{ userId: reqUser.id, role: 1 },
							...userIds.map((id) => ({
								userId: id,
								role: 0,
							})),
						],
					},
				},
			},
		});

		res.header('cache-control', 'no-cache');
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
		res.header('cache-control', 'no-cache');
		res.send({ code: 200, data: projects });
	} catch (error) {
		res.send({ code: 400, error });
	}
}

export async function queryProjectInfo(req: FastifyRequest, res: FastifyReply) {
	const query = z.object({ prefix: z.string() }).parse(req.query);
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
	res.header('cache-control', 'no-cache');
	res.send({ code: 200, data: { ...record, ...((iconSet || {}) as APIv2CollectionResponse) } });
}

export async function handlePackSvgJson(req: FastifyRequest, res: FastifyReply) {
	try {
		const query = z.object({ projectId: z.string().transform((v) => parseInt(v)) }).parse(req.query);
		const record = await prisma.project.findUnique({
			where: { id: query.projectId },
			select: { projectIconSetJSON: true },
		});
		res.header('cache-control', 'no-cache');
		return { code: 200, data: record };
	} catch (error) {
		res.send({ code: 400, error });
	}
}
// TODO: 返回 SvgSymbolUse 格式字符串
export async function handlePackSvgSymbolUse(req: FastifyRequest, res: FastifyReply) {
	try {
	} catch (error) {
		res.send({ code: 400, error });
	}
}

export async function handleRemoveIconsFromProject(req: FastifyRequest, res: FastifyReply) {
	try {
		const q = z
			.object({
				projectId: z.string().transform((v) => parseInt(v)),
				icons: z.array(z.string()),
			})
			.parse(req.body);

		const record = await prisma.project.findUnique({ where: { id: q.projectId } });
		if (!record) return res.send({ code: 400, error: 'project not found' });
		// parse to IconSet for add icons
		const iconSet = new IconSet(JSON.parse(record?.projectIconSetJSON as string) as IconifyJSON);
		q.icons.forEach((icon) => iconSet.remove(icon));

		// write db & custom icons dir
		const newIconSetJSON = JSON.stringify(iconSet.export(true));
		await writeIconSet(record.prefix, newIconSetJSON);
		await prisma.project.update({
			where: { id: record.id },
			data: { projectIconSetJSON: newIconSetJSON },
		});
		// update iconset cache data
		await triggerIconSetsUpdate(1);

		res.header('cache-control', 'no-cache');
		res.send({ code: 200 });
	} catch (error) {
		res.send({ code: 400, error });
	}
}
