import { EncountersController } from './encounters.controller';
import { EncountersService } from './encounters.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';

describe('EncountersController', () => {
  let controller: EncountersController;
  let service: {
    create: jest.Mock;
    findAllForRun: jest.Mock;
    findOneForRun: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  const user: JwtPayload = { sub: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    service = {
      create: jest.fn(),
      findAllForRun: jest.fn(),
      findOneForRun: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    // Instantiated directly rather than through Test.createTestingModule: the
    // class-level @UseGuards(JwtAuthGuard) pulls in real JWT dependencies
    // that a bare testing module can't resolve (see auth.controller.spec.ts).
    controller = new EncountersController(
      service as unknown as EncountersService,
    );
  });

  describe('create', () => {
    it('delegates to EncountersService.create with the current user id and run id', async () => {
      const encounter = { id: 'enc-1' };
      service.create.mockResolvedValue(encounter);
      const dto = { routeId: 'route-1' };

      await expect(controller.create(user, 'run-1', dto)).resolves.toBe(
        encounter,
      );
      expect(service.create).toHaveBeenCalledWith('user-1', 'run-1', dto);
    });
  });

  describe('findAll', () => {
    it('delegates to EncountersService.findAllForRun', async () => {
      const encounters = [{ id: 'enc-1' }];
      service.findAllForRun.mockResolvedValue(encounters);

      await expect(controller.findAll(user, 'run-1')).resolves.toBe(encounters);
      expect(service.findAllForRun).toHaveBeenCalledWith('user-1', 'run-1');
    });
  });

  describe('findOne', () => {
    it('delegates to EncountersService.findOneForRun', async () => {
      const encounter = { id: 'enc-1' };
      service.findOneForRun.mockResolvedValue(encounter);

      await expect(controller.findOne(user, 'run-1', 'enc-1')).resolves.toBe(
        encounter,
      );
      expect(service.findOneForRun).toHaveBeenCalledWith(
        'user-1',
        'run-1',
        'enc-1',
      );
    });
  });

  describe('update', () => {
    it('delegates to EncountersService.update', async () => {
      const encounter = { id: 'enc-1', status: 'CAUGHT' };
      service.update.mockResolvedValue(encounter);
      const dto = { status: 'CAUGHT' as const };

      await expect(
        controller.update(user, 'run-1', 'enc-1', dto),
      ).resolves.toBe(encounter);
      expect(service.update).toHaveBeenCalledWith(
        'user-1',
        'run-1',
        'enc-1',
        dto,
      );
    });
  });

  describe('remove', () => {
    it('delegates to EncountersService.remove', async () => {
      service.remove.mockResolvedValue(undefined);

      await controller.remove(user, 'run-1', 'enc-1');
      expect(service.remove).toHaveBeenCalledWith('user-1', 'run-1', 'enc-1');
    });
  });
});
