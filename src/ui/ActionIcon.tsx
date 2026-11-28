import {
  Apple,
  Award,
  BookOpen,
  Briefcase,
  Camera,
  Code2,
  Coffee,
  Droplets,
  Flame,
  Footprints,
  Gamepad2,
  Heart,
  Home,
  Leaf,
  MessageCircle,
  Moon,
  Music,
  Palette,
  PenTool,
  Phone,
  Pizza,
  Shirt,
  Smile,
  Sofa,
  Sparkles,
  Sun,
  Truck,
  Tv,
  Users,
  Utensils,
  Zap,
} from 'lucide-react';

export function ActionIcon({ name, size = 15 }: { name: string; size?: number }) {
  switch (name) {
    case 'moon':
      return <Moon size={size} />;
    case 'sun':
      return <Sun size={size} />;
    case 'sofa':
      return <Sofa size={size} />;
    case 'apple':
      return <Apple size={size} />;
    case 'utensils':
      return <Utensils size={size} />;
    case 'flame':
      return <Flame size={size} />;
    case 'coffee':
      return <Coffee size={size} />;
    case 'pen':
      return <PenTool size={size} />;
    case 'phone':
      return <Phone size={size} />;
    case 'shirt':
      return <Shirt size={size} />;
    case 'tv':
      return <Tv size={size} />;
    case 'gamepad':
      return <Gamepad2 size={size} />;
    case 'book':
      return <BookOpen size={size} />;
    case 'droplet':
      return <Droplets size={size} />;
    case 'sparkles':
      return <Sparkles size={size} />;
    case 'zap':
      return <Zap size={size} />;
    case 'smile':
      return <Smile size={size} />;
    case 'leaf':
      return <Leaf size={size} />;
    case 'briefcase':
      return <Briefcase size={size} />;
    case 'pizza':
      return <Pizza size={size} />;
    case 'music':
      return <Music size={size} />;
    case 'camera':
      return <Camera size={size} />;
    case 'message':
      return <MessageCircle size={size} />;
    case 'users':
      return <Users size={size} />;
    case 'truck':
      return <Truck size={size} />;
    case 'award':
      return <Award size={size} />;
    case 'code':
      return <Code2 size={size} />;
    case 'palette':
      return <Palette size={size} />;
    case 'heart':
      return <Heart size={size} />;
    case 'home':
      return <Home size={size} />;
    case 'footprints':
    default:
      return <Footprints size={size} />;
  }
}
