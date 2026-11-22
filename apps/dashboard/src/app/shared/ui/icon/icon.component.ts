import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideAngularModule,
  LayoutDashboard, Workflow, FlaskConical, Inbox, MessagesSquare,
  AlertTriangle, TrendingUp, TrendingDown, Settings, Home,
  Plus, Search, X, Check, Copy, Download, Upload, RefreshCw, Play, Pause,
  Save, Edit2, Trash2, ExternalLink, Send, Filter, Calendar,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  ArrowRight, ArrowLeft, ArrowUp, ArrowDown, ArrowUpRight,
  CheckCircle2, XCircle, AlertCircle, Info, Clock, Loader2, Circle,
  User, Users, LogOut, Key, Mail, Shield, Crown, Lock, Eye, EyeOff,
  HelpCircle, BookOpen, Sparkles, Zap, Bot, Menu, MoreHorizontal,
  MoreVertical, Command, PanelLeft, Rocket, Activity, Gauge,
  CreditCard, Plug, Webhook,
  Heart, Pin, Flag, MessageCircle, Megaphone, FileText, Code, MessageSquare,
  Brain, Star, Terminal, Database, Globe, Table, GitBranch, Layers, Scale, List,
  // NEW — admin
  Share2, UserCheck, Server,
} from 'lucide-angular';

const ICONS: Record<string, any> = {
  'layout-dashboard': LayoutDashboard, workflow: Workflow,
  flask: FlaskConical, inbox: Inbox, messages: MessagesSquare,
  'alert-triangle': AlertTriangle, 'trending-up': TrendingUp,
  'trending-down': TrendingDown, settings: Settings, home: Home,
  plus: Plus, search: Search, x: X, check: Check, copy: Copy,
  download: Download, upload: Upload, refresh: RefreshCw, play: Play,
  pause: Pause, save: Save, edit: Edit2, trash: Trash2,
  'external-link': ExternalLink, send: Send, filter: Filter, calendar: Calendar,
  'chevron-down': ChevronDown, 'chevron-up': ChevronUp,
  'chevron-left': ChevronLeft, 'chevron-right': ChevronRight,
  'arrow-right': ArrowRight, 'arrow-left': ArrowLeft,
  'arrow-up': ArrowUp, 'arrow-down': ArrowDown, 'arrow-up-right': ArrowUpRight,
  'check-circle': CheckCircle2, 'x-circle': XCircle, 'alert-circle': AlertCircle,
  info: Info, clock: Clock, loader: Loader2, circle: Circle,
  user: User, users: Users, logout: LogOut, key: Key, mail: Mail,
  shield: Shield, crown: Crown, lock: Lock, eye: Eye, 'eye-off': EyeOff,
  help: HelpCircle, book: BookOpen, sparkles: Sparkles, zap: Zap,
  bot: Bot, menu: Menu, 'more-horizontal': MoreHorizontal,
  'more-vertical': MoreVertical, command: Command, 'panel-left': PanelLeft,
  rocket: Rocket, activity: Activity, gauge: Gauge,
  'credit-card': CreditCard, plug: Plug, webhook: Webhook,
  heart: Heart, pin: Pin, flag: Flag, 'message-circle': MessageCircle,
  megaphone: Megaphone, 'file-text': FileText, code: Code, 'message-square': MessageSquare,
  brain: Brain, star: Star, terminal: Terminal, database: Database,
  globe: Globe, table: Table, 'git-branch': GitBranch, layers: Layers, scale: Scale,
  list: List, share: Share2, 'user-check': UserCheck, server: Server,
} as const;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <lucide-icon
      [img]="iconData()"
      [size]="size()"
      [strokeWidth]="strokeWidth()"
      [color]="color()"
      class="inline-block shrink-0"
      [attr.aria-hidden]="ariaLabel() ? null : 'true'"
      [attr.aria-label]="ariaLabel()"
    />
  `,
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input<number>(16);
  readonly strokeWidth = input<number>(1.75);
  readonly color = input<string>('currentColor');
  readonly ariaLabel = input<string | undefined>(undefined);

  readonly iconData = computed<any>(() => {
    const icon = ICONS[this.name()];
    if (!icon) {
      console.warn(`[Icon] Unknown icon: ${this.name()}`);
      return Circle;
    }
    return icon;
  });
}