import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { VitalStatus } from '../../../generated/prisma/client';

export class CreateEncounterDto {
  @IsUUID(7)
  routeId: string;

  @IsOptional()
  @IsUUID(7)
  speciesId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsBoolean()
  caught?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @IsOptional()
  @IsEnum(VitalStatus)
  vitalStatus?: VitalStatus;
}
