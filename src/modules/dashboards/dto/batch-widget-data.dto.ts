import { IsArray, IsString, IsDateString, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BatchWidgetDataDto {
  @ApiProperty({ type: [String], description: 'Widget IDs to fetch data for (1-50)' })
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1, { message: 'At least one widget ID is required' })
  @ArrayMaxSize(50, { message: 'Maximum 50 widget IDs allowed' })
  widgetIds: string[];

  @ApiProperty({ example: '2024-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsDateString({}, { message: 'Invalid date format for "from", use YYYY-MM-DD' })
  from: string;

  @ApiProperty({ example: '2024-01-31', description: 'End date (YYYY-MM-DD), must be after "from"' })
  @IsDateString({}, { message: 'Invalid date format for "to", use YYYY-MM-DD' })
  to: string;
}
