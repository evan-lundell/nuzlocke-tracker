import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';

describe('RunsController', () => {
  let controller: RunsController;
  let service: {
    create: jest.Mock;
    findAllForUser: jest.Mock;
    findOneForUser: jest.Mock;
  };
  const user: JwtPayload = { sub: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAllForUser: jest.fn(),
      findOneForUser: jest.fn(),
    };

    // Instantiated directly rather than through Test.createTestingModule: the
    // class-level @UseGuards(JwtAuthGuard) pulls in real JWT dependencies
    // that a bare testing module can't resolve (see auth.controller.spec.ts).
    controller = new RunsController(service as unknown as RunsService);
  });

  describe('create', () => {
    it('delegates to RunsService.create with the current user id', async () => {
      const run = { id: 'run-1' };
      service.create.mockResolvedValue(run);
      const dto = { gameId: 'game-1' };

      await expect(controller.create(user, dto)).resolves.toBe(run);
      expect(service.create).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('findAll', () => {
    it('delegates to RunsService.findAllForUser with the current user id', async () => {
      const runs = [{ id: 'run-1' }];
      service.findAllForUser.mockResolvedValue(runs);

      await expect(controller.findAll(user)).resolves.toBe(runs);
      expect(service.findAllForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('findOne', () => {
    it('delegates to RunsService.findOneForUser with the current user id and run id', async () => {
      const run = { id: 'run-1' };
      service.findOneForUser.mockResolvedValue(run);

      await expect(controller.findOne(user, 'run-1')).resolves.toBe(run);
      expect(service.findOneForUser).toHaveBeenCalledWith('user-1', 'run-1');
    });
  });
});
