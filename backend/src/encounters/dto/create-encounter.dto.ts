import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EncounterStatus, VitalStatus } from '../../../generated/prisma/client';

export class CreateEncounterDto {
  @IsUUID('7')
  routeId: string;

  @IsOptional()
  @IsUUID('7')
  speciesId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsEnum(EncounterStatus)
  status?: EncounterStatus;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nickname?: string;

  @IsOptional()
  @IsEnum(VitalStatus)
  vitalStatus?: VitalStatus;
}
