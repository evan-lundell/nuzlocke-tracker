import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RunOwnershipService } from './run-ownership.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RunOwnershipService', () => {
  let service: RunOwnershipService;
  let prisma: { run: { findFirst: jest.Mock } };

  beforeEach(async () => {
    prisma = { run: { findFirst: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RunOwnershipService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RunOwnershipService>(RunOwnershipService);
  });

  it('throws NotFoundException when the run does not exist or is not owned by the user', async () => {
    prisma.run.findFirst.mockResolvedValue(null);

    await expect(service.assertOwnership('user-1', 'run-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.run.findFirst).toHaveBeenCalledWith({
      where: { id: 'run-1', userId: 'user-1' },
    });
  });

  it('returns the run when owned by the user', async () => {
    const run = { id: 'run-1' };
    prisma.run.findFirst.mockResolvedValue(run);

    await expect(service.assertOwnership('user-1', 'run-1')).resolves.toBe(run);
  });
});
