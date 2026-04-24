import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiCookieAuth,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto, RefreshResponseDto } from './dto/auth-response.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './strategies/jwt.strategy';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── POST /auth/register ───────────────────────────────────────────────────
  // Rate limited: 5 attempts per 15 minutes per IP
  // Prevents account spam and enumeration at scale

  @Public()
  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  @ApiOperation({ summary: 'Create a new agency account' })
  @ApiResponse({ status: 201, type: AuthResponseDto })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { response, rawRefreshToken } = await this.authService.register(
      dto,
      req.headers['user-agent'],
      req.ip,
    );

    res.cookie(
      REFRESH_COOKIE,
      rawRefreshToken,
      this.authService['tokenService'].refreshCookieOptions(),
    );

    return response;
  }

  // ─── POST /auth/login ──────────────────────────────────────────────────────
  // Rate limited: 10 attempts per 15 minutes per IP
  // Brute-force protection — bcrypt is slow (~300ms) but rate limiting adds
  // an additional layer that blocks volumetric attacks before they hit bcrypt

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900_000 } })
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 429, description: 'Too many attempts — rate limited' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { response, rawRefreshToken } = await this.authService.login(
      dto,
      req.headers['user-agent'],
      req.ip,
    );

    res.cookie(
      REFRESH_COOKIE,
      rawRefreshToken,
      this.authService['tokenService'].refreshCookieOptions(),
    );

    return response;
  }

  // ─── POST /auth/refresh ────────────────────────────────────────────────────
  // No rate limit — refresh tokens are opaque random strings (not guessable).
  // Any invalid/expired/revoked token immediately throws 401.

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_COOKIE)
  @ApiOperation({ summary: 'Rotate refresh token and get new access token' })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;

    const { response, rawRefreshToken: newRawToken } =
      await this.authService.refresh(
        rawRefreshToken,
        req.headers['user-agent'],
        req.ip,
      );

    res.cookie(
      REFRESH_COOKIE,
      newRawToken,
      this.authService['tokenService'].refreshCookieOptions(),
    );

    return response;
  }

  // ─── POST /auth/logout ─────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Revoke current session refresh token' })
  @ApiResponse({ status: 204, description: 'Logged out' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.authService.logout(rawRefreshToken);

    // Clear the cookie client-side
    res.cookie(
      REFRESH_COOKIE,
      '',
      this.authService['tokenService'].refreshCookieOptions(true),
    );
  }

  // ─── GET /auth/me ──────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current authenticated user profile' })
  @ApiResponse({ status: 200 })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<unknown> {
    return this.authService.getMe(user.id);
  }
}
