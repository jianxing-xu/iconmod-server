import { User } from '@prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../data/prisma.js';

export function handleAddUserToProject(req: FastifyRequest, res: FastifyReply) {}

export function handleAddIcon(req: FastifyRequest, res: FastifyReply) {}

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
