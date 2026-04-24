import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignStaffDto {
  @ApiProperty({ description: 'UUID of the AGENCY_STAFF user to assign' })
  @IsUUID()
  userId: string;
}
