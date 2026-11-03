import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadSerif } from '@remotion/google-fonts/SourceSerif4';

/** Contrast against paper: ink 15.05, inkSoft 7.17, blue 5.90, gold edge 3.53 (non-text). */
export const C = {
  paper: '#FAF8F3',
  ink: '#14213D',
  inkSoft: '#4A5468',
  yellow: '#FFD84D',
  yellowPale: '#FFF0B3',
  gold: '#A67E00',
  blue: '#2559C9',
  card: '#FFFFFF',
  rule: '#E4E1D8',
  chip: '#F2F0E9',
};

export const SANS = loadInter('normal', { weights: ['400', '500', '600', '800', '900'] }).fontFamily;
export const SERIF = loadSerif('normal', { weights: ['400', '600'] }).fontFamily;
export const SERIF_ITALIC = loadSerif('italic', { weights: ['400'] }).fontFamily;

export const FPS = 30;
/** 108 BPM: one beat is 16.67 frames, one bar 66.67. Cuts land on beats. */
export const BEAT = (60 / 108) * FPS;
