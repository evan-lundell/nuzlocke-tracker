import { PartyController } from './party.controller';
import { PartyService } from './party.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';

describe('PartyController', () => {
  let controller: PartyController;
  let service: {
    create: jest.Mock;
    findAllForRun: jest.Mock;
    remove: jest.Mock;
  };
  const user: JwtPayload = { sub: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAllForRun: jest.fn(),
      remove: jest.fn(),
    };

    // Instantiated directly rather than through Test.createTestingModule: the
    // class-level @UseGuards(JwtAuthGuard) pulls in real JWT dependencies
    // that a bare testing module can't resolve (see auth.controller.spec.ts).
    controller = new PartyController(service as unknown as PartyService);
  });

  describe('create', () => {
    it('delegates to PartyService.create with the current user id and run id', async () => {
      const membership = { id: 'mem-1' };
      service.create.mockResolvedValue(membership);
      const dto = { encounterId: 'enc-1' };

      await expect(controller.create(user, 'run-1', dto)).resolves.toBe(
        membership,
      );
      expect(service.create).toHaveBeenCalledWith('user-1', 'run-1', dto);
    });
  });

  describe('findAll', () => {
    it('delegates to PartyService.findAllForRun', async () => {
      const memberships = [{ id: 'mem-1' }];
      service.findAllForRun.mockResolvedValue(memberships);

      await expect(controller.findAll(user, 'run-1')).resolves.toBe(
        memberships,
      );
      expect(service.findAllForRun).toHaveBeenCalledWith('user-1', 'run-1');
    });
  });

  describe('remove', () => {
    it('delegates to PartyService.remove', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(user, 'run-1', 'enc-1');
      expect(service.remove).toHaveBeenCalledWith('user-1', 'run-1', 'enc-1');
    });
  });
});
