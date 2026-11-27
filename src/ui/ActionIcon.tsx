import {
  Apple,
  BookOpen,
  Coffee,
  Droplets,
  Flame,
  Footprints,
  Gamepad2,
  Leaf,
  Moon,
  PenTool,
  Phone,
  Smile,
  Sofa,
  Sparkles,
  Sun,
  Tv,
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
    case 'footprints':
    default:
      return <Footprints size={size} />;
  }
}
