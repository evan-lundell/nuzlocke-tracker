import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RunRuleSelectionDto {
  @IsUUID(7)
  ruleId: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class CreateRunDto {
  @IsUUID(7)
  gameId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RunRuleSelectionDto)
  rules?: RunRuleSelectionDto[];
}
