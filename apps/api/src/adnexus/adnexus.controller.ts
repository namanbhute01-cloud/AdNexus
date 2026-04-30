import { Body, Controller, Get, Param, Patch, Post, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdNexusService } from './adnexus.service';
import { AdNexusRole } from './adnexus.types';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UploadContentDto } from './dto/upload-content.dto';
import { UpdateScreenDto } from './dto/update-screen.dto';

@Controller('auth')
export class AdNexusAuthController {
  constructor(private readonly adnexusService: AdNexusService) {}

  @Post('bootstrap-admin')
  bootstrapAdmin() {
    return this.adnexusService.ensureBootstrapAdmin().then((existing) => {
      if (existing) {
        return { alreadyBootstrapped: true };
      }
      return { ok: true };
    });
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.adnexusService.loginUser(dto.username, dto.password);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(
    @Request()
    req: {
      user: { sub: string; username: string; roles: string[]; screenId?: string; evLocation?: string };
    },
  ) {
    return {
      id: req.user.sub,
      username: req.user.username,
      role: req.user.roles[0] ?? null,
      screenId: req.user.screenId ?? null,
      evLocation: req.user.evLocation ?? null,
    };
  }
}

@Controller('screen')
export class AdNexusScreenController {
  constructor(private readonly adnexusService: AdNexusService) {}

  @Post('login')
  loginScreen(@Body() dto: LoginDto & { screenId?: string; evLocation?: string; uniqueHardwareId?: string; name?: string }) {
    return this.adnexusService.loginScreen(dto.username, dto.password, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdNexusRole.Screen)
  me(
    @Request()
    req: {
      user: { sub: string; username: string; roles: string[]; screenId?: string; evLocation?: string };
    },
  ) {
    return {
      id: req.user.sub,
      username: req.user.username,
      role: req.user.roles[0] ?? AdNexusRole.Screen,
      screenId: req.user.screenId ?? null,
      evLocation: req.user.evLocation ?? null,
    };
  }

  @Get('state')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AdNexusRole.Screen)
  state(@Request() req: { user: { screenId?: string } }) {
    if (!req.user.screenId) {
      return null;
    }
    return this.adnexusService.getScreenState(req.user.screenId);
  }
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdNexusRole.Admin)
export class AdNexusAdminController {
  constructor(private readonly adnexusService: AdNexusService) {}

  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.adnexusService.createUser(dto);
  }

  @Get('users')
  listUsers() {
    return this.adnexusService.listUsers();
  }

  @Get('screens')
  listScreens() {
    return this.adnexusService.listScreens();
  }

  @Patch('screens/:id')
  updateScreen(@Param('id') id: string, @Body() dto: UpdateScreenDto) {
    return this.adnexusService.updateScreen(id, dto);
  }

  @Post('content')
  @UseInterceptors(FileInterceptor('file'))
  uploadContent(@UploadedFile() file: Express.Multer.File, @Body() dto: UploadContentDto & { ownerId?: string }, @Request() req: { user: { sub?: string; username?: string } }) {
    const ownerId = dto.ownerId ?? req.user.sub ?? '';
    return this.adnexusService.uploadContent(file, dto, ownerId);
  }

  @Get('content')
  listContent() {
    return this.adnexusService.listContent();
  }

  @Post('schedule')
  createSchedule(@Body() dto: CreateScheduleDto, @Request() req: { user: { sub?: string } }) {
    return this.adnexusService.createSchedules(dto, req.user.sub ?? '');
  }

  @Get('schedule')
  listSchedule() {
    return this.adnexusService.listSchedules();
  }
}

@Controller('campaigner')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AdNexusRole.Campaigner)
export class AdNexusCampaignerController {
  constructor(private readonly adnexusService: AdNexusService) {}

  @Get('screens')
  screens() {
    return this.adnexusService.getCampaignerScreens();
  }
}
