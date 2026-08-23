import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  EncounterStatus,
  PokemonType,
  VitalStatus,
} from '../../../generated/prisma/client';

export class UpdateEncounterDto {
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

  @IsOptional()
  @IsEnum(PokemonType)
  lockedType?: PokemonType;
}
