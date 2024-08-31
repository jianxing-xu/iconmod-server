import { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../../data/prisma.js';
import { User } from '@prisma/client';

export type RegisterBody = {
	email: string;
	name: string;
	pwd: string;
};
export async function handleRegister(req: FastifyRequest, res: FastifyReply) {
	const body = req.body as RegisterBody;
	try {
		const record = await prisma.user.create({
			data: {
				email: body.email,
				name: body.name,
				pwd: body.pwd,
			},
			include: {
				projectMembers: true,
			},
		});
		const { pwd: _, ...o } = record;
		res.send({ code: 200, data: o, token: await res.jwtSign(o) });
	} catch (error) {
		res.send({ code: 400, error });
	}
}

export type LoginBody = {
	email: string;
	pwd: string;
};
export async function handleLogin(req: FastifyRequest, res: FastifyReply) {
	try {
		const body = req.body as LoginBody;
		console.log(body);
		const user = await prisma.user.findUnique({ where: { email: body.email } });
		console.log(user);
		if (!user) return res.send({ code: 400, error: 'user not found' });
		const { pwd, ...o } = user;
		if (body.pwd !== pwd) return res.send({ code: 400, error: 'email or pwd error' });
		const token = await res.jwtSign(o);
		res.send({ code: 200, data: user, token });
	} catch (error) {
		console.log(error);
		res.send({ code: 400, error });
	}
}
export function handleUserInfo(req: FastifyRequest, res: FastifyReply) {
	const reqUser = req.user as User;
	const user = prisma.user.findUnique({ where: { id: reqUser.id } });
	res.send({ code: 200, data: user });
}

export type SearchUserQuery = {
	keyword: string;
};
export async function handleSearchUser(req: FastifyRequest, res: FastifyReply) {
	const query = req.query as SearchUserQuery;
	if (!query.keyword.trim()) {
		return res.send({ code: 200, data: [] });
	}
	try {
		const records = await prisma.user.findMany({
			where: { name: { contains: query.keyword.trim() } },
			select: { id: true, name: true, email: true },
		});
		res.send({ code: 200, data: records });
	} catch (error) {
		res.send({ code: 200, error });
	}
}
