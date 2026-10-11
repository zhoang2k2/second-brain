import { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { ProjectService } from './service';
import { RegisterProjectCommandSchema, RegisterVaultCommandSchema } from '@zhon/contracts';

export interface ProjectRoutesOptions {
  service: ProjectService;
}

export const projectRoutes: FastifyPluginAsync<ProjectRoutesOptions> = async (fastify: FastifyInstance, options) => {
  const { service } = options;

  // GET /v1/projects
  fastify.get('/v1/projects', async (_request: FastifyRequest, reply: FastifyReply) => {
    const projects = service.listProjects();
    return reply.send({ ok: true, value: projects });
  });

  // GET /v1/vaults
  fastify.get('/v1/vaults', async (_request: FastifyRequest, reply: FastifyReply) => {
    const vaults = service.listVaults();
    return reply.send({ ok: true, value: vaults });
  });

  const invalidCommand = (reply: FastifyReply) => reply.status(400).send({
    ok: false, error: { code: 'INVALID_COMMAND', message: 'Command envelope is invalid', retryable: false },
  });
  const handleRegisterProject = async (request: FastifyRequest, reply: FastifyReply) => {
    const command = RegisterProjectCommandSchema.safeParse(request.body);
    if (!command.success) return invalidCommand(reply);
    return reply.send(await service.registerProject(command.data));
  };
  const handleRegisterVault = async (request: FastifyRequest, reply: FastifyReply) => {
    const command = RegisterVaultCommandSchema.safeParse(request.body);
    if (!command.success) return invalidCommand(reply);
    return reply.send(await service.registerVault(command.data));
  };

  // Support both POST /v1/commands/<name> and POST /v1/<name>
  fastify.post('/v1/commands/registerProject', handleRegisterProject);
  fastify.post('/v1/registerProject', handleRegisterProject);

  fastify.post('/v1/commands/registerVault', handleRegisterVault);
  fastify.post('/v1/registerVault', handleRegisterVault);
};
