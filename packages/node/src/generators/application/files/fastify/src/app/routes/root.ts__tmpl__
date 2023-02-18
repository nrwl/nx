import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function(fastify: FastifyInstance) {
  fastify.get('/', async function(request: FastifyRequest, reply: FastifyReply) {
    return { message: 'Hello API' };
  });
}
