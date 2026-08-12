import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { JwtPayload } from '../auth/types/jwt-payload.type';

describe('RulesController', () => {
  let controller: RulesController;
  let service: { findAllForUser: jest.Mock };
  const user: JwtPayload = { sub: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    service = { findAllForUser: jest.fn() };

    // Instantiated directly rather than through Test.createTestingModule: the
    // class-level @UseGuards(JwtAuthGuard) pulls in real JWT dependencies
    // that a bare testing module can't resolve (see auth.controller.spec.ts).
    controller = new RulesController(service as unknown as RulesService);
  });

  describe('findAll', () => {
    it("delegates to RulesService.findAllForUser with the current user's id", async () => {
      const rules = [{ id: '1', name: 'Type-lock' }];
      service.findAllForUser.mockResolvedValue(rules);

      await expect(controller.findAll(user)).resolves.toBe(rules);
      expect(service.findAllForUser).toHaveBeenCalledWith('user-1');
    });
  });
});
