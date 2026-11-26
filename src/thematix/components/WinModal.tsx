import React, { useEffect, useState } from 'react';
import { Trophy, Star, Eye, Calendar, Shuffle, Sparkles, X, Crown } from 'lucide-react';
import { Puzzle } from '../types/game';

interface SprayStickerVariant {
  line1: string;
  line2: string;
  line1Size?: number;
  line2Size?: number;
  mistPrimary: string;
  mistSecondary: string;
  borderColor: string;
  accentStreak: string;
  textGradStart: string;
  textGradMid: string;
  textGradEnd: string;
  line2Stroke: string;
  tiltClass: string;
}

type StickerTierKey = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const STICKER_POOLS_BY_GUESSES: Record<StickerTierKey, SprayStickerVariant[]> = {
  // 0 guesses — Cheating accusations!
  0: [
    {
      line1: "I'm sure you lot are",
      line2: 'cheating! LoL',
      mistPrimary: '#ec4899',
      mistSecondary: '#a3e635',
      borderColor: '#d9ff2e',
      accentStreak: '#ff3d8b',
      textGradStart: '#d9ff2e',
      textGradMid: '#fff14d',
      textGradEnd: '#ff6b9d',
      line2Stroke: '#ff3d8b',
      tiltClass: '-rotate-6',
    },
    {
      line1: 'Alright, who peeked',
      line2: 'at the answers?!',
      mistPrimary: '#06b6d4',
      mistSecondary: '#facc15',
      borderColor: '#22d3ee',
      accentStreak: '#facc15',
      textGradStart: '#67e8f9',
      textGradMid: '#fef08a',
      textGradEnd: '#38bdf8',
      line2Stroke: '#06b6d4',
      tiltClass: '-rotate-3',
    },
    {
      line1: 'Suspiciously good...',
      line2: 'Checking your tabs!',
      line2Size: 38,
      mistPrimary: '#f97316',
      mistSecondary: '#ec4899',
      borderColor: '#fb923c',
      accentStreak: '#f43f5e',
      textGradStart: '#fde047',
      textGradMid: '#fb923c',
      textGradEnd: '#fb7185',
      line2Stroke: '#f43f5e',
      tiltClass: 'rotate-3',
    },
    {
      line1: 'No way you knew that',
      line2: 'without Google! LoL',
      line1Size: 33,
      line2Size: 37,
      mistPrimary: '#a855f7',
      mistSecondary: '#84cc16',
      borderColor: '#bef264',
      accentStreak: '#c084fc',
      textGradStart: '#bef264',
      textGradMid: '#fef08a',
      textGradEnd: '#d8b4fe',
      line2Stroke: '#a855f7',
      tiltClass: '-rotate-5',
    },
    {
      line1: 'Hold on... are you',
      line2: 'reading my screen?!',
      line2Size: 38,
      mistPrimary: '#ec4899',
      mistSecondary: '#f6c915',
      borderColor: '#f6c915',
      accentStreak: '#ff3d8b',
      textGradStart: '#fde047',
      textGradMid: '#f6c915',
      textGradEnd: '#ff6b9d',
      line2Stroke: '#ec4899',
      tiltClass: 'rotate-4',
    },
    {
      line1: 'Calling the Puzzle',
      line2: 'Police right now!',
      mistPrimary: '#ef4444',
      mistSecondary: '#38bdf8',
      borderColor: '#38bdf8',
      accentStreak: '#ef4444',
      textGradStart: '#7dd3fc',
      textGradMid: '#ffffff',
      textGradEnd: '#f87171',
      line2Stroke: '#ef4444',
      tiltClass: '-rotate-6',
    },
    {
      line1: 'Zero chance that was',
      line2: 'all your own brain!',
      line1Size: 33,
      line2Size: 38,
      mistPrimary: '#22c55e',
      mistSecondary: '#facc15',
      borderColor: '#4ade80',
      accentStreak: '#facc15',
      textGradStart: '#fef08a',
      textGradMid: '#86efac',
      textGradEnd: '#fde047',
      line2Stroke: '#22c55e',
      tiltClass: 'rotate-2',
    },
    {
      line1: 'Okay Sherlock, put',
      line2: 'the cheat sheet down!',
      line2Size: 36,
      mistPrimary: '#f59e0b',
      mistSecondary: '#ec4899',
      borderColor: '#f6c915',
      accentStreak: '#f472b6',
      textGradStart: '#fef08a',
      textGradMid: '#fbbf24',
      textGradEnd: '#f472b6',
      line2Stroke: '#db2777',
      tiltClass: '-rotate-4',
    },
    {
      line1: 'Chat, are they',
      line2: 'actually cheating?!',
      line2Size: 38,
      mistPrimary: '#d946ef',
      mistSecondary: '#22d3ee',
      borderColor: '#e879f9',
      accentStreak: '#22d3ee',
      textGradStart: '#67e8f9',
      textGradMid: '#f0abfc',
      textGradEnd: '#fde047',
      line2Stroke: '#d946ef',
      tiltClass: 'rotate-5',
    },
    {
      line1: 'That was WAY too',
      line2: 'fast... SUS! LoL',
      mistPrimary: '#fb7185',
      mistSecondary: '#a3e635',
      borderColor: '#d9ff2e',
      accentStreak: '#fb7185',
      textGradStart: '#d9ff2e',
      textGradMid: '#fde047',
      textGradEnd: '#fb7185',
      line2Stroke: '#f43f5e',
      tiltClass: '-rotate-5',
    },
    {
      line1: 'Nice try, I saw you',
      line2: 'peeking at hints!',
      mistPrimary: '#a855f7',
      mistSecondary: '#f6c915',
      borderColor: '#f6c915',
      accentStreak: '#c084fc',
      textGradStart: '#fde047',
      textGradMid: '#f6c915',
      textGradEnd: '#d8b4fe',
      line2Stroke: '#9333ea',
      tiltClass: 'rotate-3',
    },
    {
      line1: "Someone's got the",
      line2: 'answer key... LoL',
      mistPrimary: '#10b981',
      mistSecondary: '#fb923c',
      borderColor: '#34d399',
      accentStreak: '#fb923c',
      textGradStart: '#6ee7b7',
      textGradMid: '#fef08a',
      textGradEnd: '#fdba74',
      line2Stroke: '#f97316',
      tiltClass: '-rotate-4',
    },
  ],

  // 1 guess — Not bad!
  1: [
    {
      line1: 'Not bad at all...',
      line2: 'Just 1 little slip!',
      line2Size: 38,
      mistPrimary: '#10b981',
      mistSecondary: '#facc15',
      borderColor: '#34d399',
      accentStreak: '#f6c915',
      textGradStart: '#6ee7b7',
      textGradMid: '#fef08a',
      textGradEnd: '#34d399',
      line2Stroke: '#10b981',
      tiltClass: '-rotate-4',
    },
    {
      line1: 'Oooh, not bad!',
      line2: '1 guess? Respect!',
      mistPrimary: '#22d3ee',
      mistSecondary: '#a3e635',
      borderColor: '#67e8f9',
      accentStreak: '#a3e635',
      textGradStart: '#a3e635',
      textGradMid: '#67e8f9',
      textGradEnd: '#fef08a',
      line2Stroke: '#06b6d4',
      tiltClass: 'rotate-3',
    },
    {
      line1: 'Almost flawless...',
      line2: 'So close to SUS!',
      mistPrimary: '#f6c915',
      mistSecondary: '#22c55e',
      borderColor: '#fde047',
      accentStreak: '#4ade80',
      textGradStart: '#fef08a',
      textGradMid: '#86efac',
      textGradEnd: '#f6c915',
      line2Stroke: '#16a34a',
      tiltClass: '-rotate-5',
    },
    {
      line1: 'Okay, not bad!',
      line2: "We'll allow 1 guess!",
      line2Size: 37,
      mistPrimary: '#38bdf8',
      mistSecondary: '#f6c915',
      borderColor: '#f6c915',
      accentStreak: '#38bdf8',
      textGradStart: '#7dd3fc',
      textGradMid: '#fef08a',
      textGradEnd: '#fde047',
      line2Stroke: '#0284c7',
      tiltClass: 'rotate-4',
    },
    {
      line1: 'Clean solve! Only',
      line2: '1 guess — not bad!',
      line2Size: 38,
      mistPrimary: '#a855f7',
      mistSecondary: '#34d399',
      borderColor: '#34d399',
      accentStreak: '#c084fc',
      textGradStart: '#6ee7b7',
      textGradMid: '#ffffff',
      textGradEnd: '#d8b4fe',
      line2Stroke: '#10b981',
      tiltClass: '-rotate-3',
    },
    {
      line1: 'Barely broke a sweat',
      line2: '1 guess? Not bad!',
      line1Size: 33,
      line2Size: 39,
      mistPrimary: '#84cc16',
      mistSecondary: '#22d3ee',
      borderColor: '#bef264',
      accentStreak: '#22d3ee',
      textGradStart: '#d9ff2e',
      textGradMid: '#fef08a',
      textGradEnd: '#67e8f9',
      line2Stroke: '#65a30d',
      tiltClass: 'rotate-2',
    },
  ],

  // 2 guesses — Pretty sharp / tidy work
  2: [
    {
      line1: 'Two guesses? Tidy!',
      line2: 'Brains are awake!',
      mistPrimary: '#22d3ee',
      mistSecondary: '#a855f7',
      borderColor: '#38bdf8',
      accentStreak: '#c084fc',
      textGradStart: '#67e8f9',
      textGradMid: '#fef08a',
      textGradEnd: '#d8b4fe',
      line2Stroke: '#0284c7',
      tiltClass: '-rotate-5',
    },
    {
      line1: 'Pretty sharp work!',
      line2: 'Only 2 guesses!',
      mistPrimary: '#10b981',
      mistSecondary: '#38bdf8',
      borderColor: '#34d399',
      accentStreak: '#38bdf8',
      textGradStart: '#6ee7b7',
      textGradMid: '#7dd3fc',
      textGradEnd: '#fef08a',
      line2Stroke: '#059669',
      tiltClass: 'rotate-3',
    },
    {
      line1: 'Solid effort, chat!',
      line2: 'Just 2 tiny slips!',
      mistPrimary: '#f6c915',
      mistSecondary: '#a855f7',
      borderColor: '#f6c915',
      accentStreak: '#c084fc',
      textGradStart: '#fde047',
      textGradMid: '#f6c915',
      textGradEnd: '#e879f9',
      line2Stroke: '#9333ea',
      tiltClass: '-rotate-3',
    },
    {
      line1: 'Not shabby at all!',
      line2: '2 guesses & done!',
      mistPrimary: '#34d399',
      mistSecondary: '#facc15',
      borderColor: '#a3e635',
      accentStreak: '#facc15',
      textGradStart: '#bef264',
      textGradMid: '#fef08a',
      textGradEnd: '#6ee7b7',
      line2Stroke: '#16a34a',
      tiltClass: 'rotate-4',
    },
    {
      line1: 'Respectable solve!',
      line2: '2 guesses — clean!',
      line2Size: 38,
      mistPrimary: '#6366f1',
      mistSecondary: '#22d3ee',
      borderColor: '#818cf8',
      accentStreak: '#22d3ee',
      textGradStart: '#a5b4fc',
      textGradMid: '#67e8f9',
      textGradEnd: '#fef08a',
      line2Stroke: '#4f46e5',
      tiltClass: '-rotate-4',
    },
    {
      line1: 'Look at that brain!',
      line2: 'Only needed 2!',
      mistPrimary: '#06b6d4',
      mistSecondary: '#f59e0b',
      borderColor: '#22d3ee',
      accentStreak: '#fbbf24',
      textGradStart: '#67e8f9',
      textGradMid: '#fde047',
      textGradEnd: '#fbbf24',
      line2Stroke: '#0891b2',
      tiltClass: 'rotate-2',
    },
  ],

  // 3 guesses — Decent effort
  3: [
    {
      line1: 'Three guesses? Fair',
      line2: 'play, decent solve!',
      line2Size: 38,
      mistPrimary: '#8b5cf6',
      mistSecondary: '#facc15',
      borderColor: '#a78bfa',
      accentStreak: '#facc15',
      textGradStart: '#ddd6fe',
      textGradMid: '#fef08a',
      textGradEnd: '#c4b5fd',
      line2Stroke: '#7c3aed',
      tiltClass: '-rotate-4',
    },
    {
      line1: 'A few bumps, still',
      line2: 'got there in 3!',
      mistPrimary: '#38bdf8',
      mistSecondary: '#ec4899',
      borderColor: '#38bdf8',
      accentStreak: '#f472b6',
      textGradStart: '#7dd3fc',
      textGradMid: '#fef08a',
      textGradEnd: '#f9a8d4',
      line2Stroke: '#db2777',
      tiltClass: 'rotate-3',
    },
    {
      line1: 'Decent work! Only',
      line2: '3 guesses needed!',
      line2Size: 38,
      mistPrimary: '#14b8a6',
      mistSecondary: '#f59e0b',
      borderColor: '#2dd4bf',
      accentStreak: '#fbbf24',
      textGradStart: '#5eead4',
      textGradMid: '#fde047',
      textGradEnd: '#fbbf24',
      line2Stroke: '#0d9488',
      tiltClass: '-rotate-5',
    },
    {
      line1: 'Not your worst...',
      line2: '3 guesses is fine!',
      mistPrimary: '#f59e0b',
      mistSecondary: '#8b5cf6',
      borderColor: '#fbbf24',
      accentStreak: '#a78bfa',
      textGradStart: '#fde047',
      textGradMid: '#fbbf24',
      textGradEnd: '#c4b5fd',
      line2Stroke: '#d97706',
      tiltClass: 'rotate-4',
    },
    {
      line1: 'Warming up nicely!',
      line2: '3 guesses — solid!',
      line2Size: 38,
      mistPrimary: '#a3e635',
      mistSecondary: '#f97316',
      borderColor: '#bef264',
      accentStreak: '#fb923c',
      textGradStart: '#d9ff2e',
      textGradMid: '#fef08a',
      textGradEnd: '#fdba74',
      line2Stroke: '#ea580c',
      tiltClass: '-rotate-3',
    },
    {
      line1: 'Took 3 tries, but',
      line2: 'we take those! LoL',
      line2Size: 38,
      mistPrimary: '#d946ef',
      mistSecondary: '#facc15',
      borderColor: '#e879f9',
      accentStreak: '#facc15',
      textGradStart: '#f0abfc',
      textGradMid: '#fef08a',
      textGradEnd: '#e879f9',
      line2Stroke: '#c026d3',
      tiltClass: 'rotate-2',
    },
  ],

  // 4 guesses — Middle of the road / slightly shaky
  4: [
    {
      line1: 'Four guesses... hmm',
      line2: 'Getting a bit shaky!',
      line2Size: 37,
      mistPrimary: '#f59e0b',
      mistSecondary: '#a855f7',
      borderColor: '#fbbf24',
      accentStreak: '#c084fc',
      textGradStart: '#fde047',
      textGradMid: '#fb923c',
      textGradEnd: '#d8b4fe',
      line2Stroke: '#d97706',
      tiltClass: '-rotate-5',
    },
    {
      line1: 'Middle of the road!',
      line2: '4 guesses — average!',
      line2Size: 37,
      mistPrimary: '#f97316',
      mistSecondary: '#38bdf8',
      borderColor: '#fb923c',
      accentStreak: '#38bdf8',
      textGradStart: '#fdba74',
      textGradMid: '#fef08a',
      textGradEnd: '#7dd3fc',
      line2Stroke: '#ea580c',
      tiltClass: 'rotate-3',
    },
    {
      line1: 'Not great, not awful',
      line2: '4 guesses! LoL',
      line1Size: 33,
      mistPrimary: '#eab308',
      mistSecondary: '#ec4899',
      borderColor: '#facc15',
      accentStreak: '#f472b6',
      textGradStart: '#fef08a',
      textGradMid: '#fbbf24',
      textGradEnd: '#f472b6',
      line2Stroke: '#db2777',
      tiltClass: '-rotate-3',
    },
    {
      line1: 'Chat had to carry',
      line2: 'a bit on 4 guesses!',
      line2Size: 37,
      mistPrimary: '#a855f7',
      mistSecondary: '#fb923c',
      borderColor: '#c084fc',
      accentStreak: '#fb923c',
      textGradStart: '#d8b4fe',
      textGradMid: '#fde047',
      textGradEnd: '#fb923c',
      line2Stroke: '#9333ea',
      tiltClass: 'rotate-4',
    },
    {
      line1: 'A little rusty today',
      line2: '4 guesses — meh!',
      line1Size: 33,
      mistPrimary: '#fb923c',
      mistSecondary: '#facc15',
      borderColor: '#f59e0b',
      accentStreak: '#facc15',
      textGradStart: '#fef08a',
      textGradMid: '#fb923c',
      textGradEnd: '#fde047',
      line2Stroke: '#c2410c',
      tiltClass: '-rotate-4',
    },
    {
      line1: 'Could be worse...',
      line2: 'Could be better! 4!',
      line2Size: 38,
      mistPrimary: '#ec4899',
      mistSecondary: '#f59e0b',
      borderColor: '#f472b6',
      accentStreak: '#fbbf24',
      textGradStart: '#f9a8d4',
      textGradMid: '#fef08a',
      textGradEnd: '#fbbf24',
      line2Stroke: '#be185d',
      tiltClass: 'rotate-2',
    },
  ],

  // 5 guesses — Sweating / struggle bus
  5: [
    {
      line1: 'Five guesses?! Oof',
      line2: 'Starting to sweat!',
      line2Size: 38,
      mistPrimary: '#f97316',
      mistSecondary: '#ef4444',
      borderColor: '#fb923c',
      accentStreak: '#f43f5e',
      textGradStart: '#fde047',
      textGradMid: '#fb923c',
      textGradEnd: '#f87171',
      line2Stroke: '#ea580c',
      tiltClass: '-rotate-5',
    },
    {
      line1: 'Bit of a struggle',
      line2: 'bus at 5 guesses!',
      line2Size: 38,
      mistPrimary: '#ec4899',
      mistSecondary: '#f97316',
      borderColor: '#fb7185',
      accentStreak: '#fb923c',
      textGradStart: '#fda4af',
      textGradMid: '#fde047',
      textGradEnd: '#fb923c',
      line2Stroke: '#e11d48',
      tiltClass: 'rotate-4',
    },
    {
      line1: 'Someone needs a',
      line2: 'coffee! 5 guesses!',
      line2Size: 38,
      mistPrimary: '#f59e0b',
      mistSecondary: '#f43f5e',
      borderColor: '#fbbf24',
      accentStreak: '#fb7185',
      textGradStart: '#fef08a',
      textGradMid: '#fb923c',
      textGradEnd: '#fda4af',
      line2Stroke: '#dc2626',
      tiltClass: '-rotate-4',
    },
    {
      line1: 'Five tries?! Brain',
      line2: 'still buffering...',
      mistPrimary: '#a855f7',
      mistSecondary: '#f43f5e',
      borderColor: '#e879f9',
      accentStreak: '#f43f5e',
      textGradStart: '#f0abfc',
      textGradMid: '#fde047',
      textGradEnd: '#fb7185',
      line2Stroke: '#be185d',
      tiltClass: 'rotate-3',
    },
    {
      line1: 'Yikes, 5 guesses...',
      line2: 'Are we awake yet?!',
      line2Size: 38,
      mistPrimary: '#fb923c',
      mistSecondary: '#d946ef',
      borderColor: '#fb923c',
      accentStreak: '#e879f9',
      textGradStart: '#fde047',
      textGradMid: '#fb923c',
      textGradEnd: '#f0abfc',
      line2Stroke: '#c026d3',
      tiltClass: '-rotate-6',
    },
    {
      line1: '5 guesses! Scraping',
      line2: 'through by a hair!',
      line1Size: 33,
      line2Size: 38,
      mistPrimary: '#ef4444',
      mistSecondary: '#facc15',
      borderColor: '#facc15',
      accentStreak: '#ef4444',
      textGradStart: '#fef08a',
      textGradMid: '#fb923c',
      textGradEnd: '#f87171',
      line2Stroke: '#dc2626',
      tiltClass: 'rotate-2',
    },
  ],

  // 6 guesses — Rough ride
  6: [
    {
      line1: 'Six guesses?! Mate',
      line2: 'that was ROUGH! LoL',
      line2Size: 36,
      mistPrimary: '#ef4444',
      mistSecondary: '#f97316',
      borderColor: '#f87171',
      accentStreak: '#fb923c',
      textGradStart: '#fde047',
      textGradMid: '#fb923c',
      textGradEnd: '#f87171',
      line2Stroke: '#dc2626',
      tiltClass: '-rotate-5',
    },
    {
      line1: 'Ouch... 6 guesses!',
      line2: 'Need a dictionary?',
      line2Size: 38,
      mistPrimary: '#f43f5e',
      mistSecondary: '#facc15',
      borderColor: '#fb7185',
      accentStreak: '#facc15',
      textGradStart: '#fef08a',
      textGradMid: '#fda4af',
      textGradEnd: '#fb7185',
      line2Stroke: '#e11d48',
      tiltClass: 'rotate-4',
    },
    {
      line1: '6 guesses?! Just',
      line2: 'clicking randomly?!',
      line2Size: 37,
      mistPrimary: '#dc2626',
      mistSecondary: '#ec4899',
      borderColor: '#f472b6',
      accentStreak: '#ef4444',
      textGradStart: '#fde047',
      textGradMid: '#f472b6',
      textGradEnd: '#f87171',
      line2Stroke: '#b91c1c',
      tiltClass: '-rotate-4',
    },
    {
      line1: 'Painful to watch...',
      line2: '6 whole guesses!',
      mistPrimary: '#ea580c',
      mistSecondary: '#ef4444',
      borderColor: '#fb923c',
      accentStreak: '#ef4444',
      textGradStart: '#fed7aa',
      textGradMid: '#fb923c',
      textGradEnd: '#f87171',
      line2Stroke: '#c2410c',
      tiltClass: 'rotate-5',
    },
    {
      line1: 'Six guesses?! Chat',
      line2: 'was screaming at ya!',
      line2Size: 36,
      mistPrimary: '#e11d48',
      mistSecondary: '#a855f7',
      borderColor: '#fb7185',
      accentStreak: '#c084fc',
      textGradStart: '#fda4af',
      textGradMid: '#fde047',
      textGradEnd: '#d8b4fe',
      line2Stroke: '#be123c',
      tiltClass: '-rotate-6',
    },
    {
      line1: 'Oof, 6 guesses...',
      line2: "We won't tell anyone!",
      line2Size: 35,
      mistPrimary: '#f97316',
      mistSecondary: '#ec4899',
      borderColor: '#facc15',
      accentStreak: '#ff3d8b',
      textGradStart: '#fef08a',
      textGradMid: '#fb923c',
      textGradEnd: '#ff6b9d',
      line2Stroke: '#db2777',
      tiltClass: 'rotate-3',
    },
  ],

  // 7 guesses — Disaster zone / barely survived
  7: [
    {
      line1: 'SEVEN guesses?!',
      line2: 'Were you blindfolded?',
      line2Size: 35,
      mistPrimary: '#ef4444',
      mistSecondary: '#facc15',
      borderColor: '#ef4444',
      accentStreak: '#facc15',
      textGradStart: '#fde047',
      textGradMid: '#f87171',
      textGradEnd: '#ef4444',
      line2Stroke: '#dc2626',
      tiltClass: '-rotate-6',
    },
    {
      line1: '7 guesses... yikes!',
      line2: 'My eyes hurt! LoL',
      mistPrimary: '#e11d48',
      mistSecondary: '#f97316',
      borderColor: '#fb7185',
      accentStreak: '#fb923c',
      textGradStart: '#fef08a',
      textGradMid: '#fb7185',
      textGradEnd: '#fb923c',
      line2Stroke: '#be123c',
      tiltClass: 'rotate-4',
    },
    {
      line1: 'How did that take',
      line2: 'SEVEN guesses?!',
      mistPrimary: '#dc2626',
      mistSecondary: '#d946ef',
      borderColor: '#f87171',
      accentStreak: '#e879f9',
      textGradStart: '#f0abfc',
      textGradMid: '#fef08a',
      textGradEnd: '#f87171',
      line2Stroke: '#b91c1c',
      tiltClass: '-rotate-5',
    },
    {
      line1: '7 guesses?! Just',
      line2: 'mash the keyboard!',
      line2Size: 37,
      mistPrimary: '#f43f5e',
      mistSecondary: '#fb923c',
      borderColor: '#f43f5e',
      accentStreak: '#fde047',
      textGradStart: '#fde047',
      textGradMid: '#fb923c',
      textGradEnd: '#fb7185',
      line2Stroke: '#e11d48',
      tiltClass: 'rotate-3',
    },
    {
      line1: "Lucky you didn't",
      line2: 'hit 8... BARELY! LoL',
      line2Size: 36,
      mistPrimary: '#ef4444',
      mistSecondary: '#a3e635',
      borderColor: '#d9ff2e',
      accentStreak: '#ef4444',
      textGradStart: '#d9ff2e',
      textGradMid: '#fde047',
      textGradEnd: '#f87171',
      line2Stroke: '#dc2626',
      tiltClass: '-rotate-4',
    },
    {
      line1: '7 guesses! Send',
      line2: 'help immediately!',
      line2Size: 38,
      mistPrimary: '#b91c1c',
      mistSecondary: '#f59e0b',
      borderColor: '#fbbf24',
      accentStreak: '#ef4444',
      textGradStart: '#fef08a',
      textGradMid: '#fb923c',
      textGradEnd: '#ef4444',
      line2Stroke: '#991b1b',
      tiltClass: 'rotate-5',
    },
  ],

  // 8+ guesses — OMG, that's terrible!
  8: [
    {
      line1: "OMG, that's",
      line2: 'TERRIBLE! LoL',
      line1Size: 38,
      line2Size: 44,
      mistPrimary: '#ef4444',
      mistSecondary: '#facc15',
      borderColor: '#ef4444',
      accentStreak: '#facc15',
      textGradStart: '#fde047',
      textGradMid: '#ff4d6d',
      textGradEnd: '#ef4444',
      line2Stroke: '#dc2626',
      tiltClass: '-rotate-6',
    },
    {
      line1: '8+ guesses?! OMG',
      line2: 'That was AWFUL! LoL',
      line2Size: 36,
      mistPrimary: '#dc2626',
      mistSecondary: '#ec4899',
      borderColor: '#ff3d8b',
      accentStreak: '#ef4444',
      textGradStart: '#fde047',
      textGradMid: '#ff6b9d',
      textGradEnd: '#ef4444',
      line2Stroke: '#b91c1c',
      tiltClass: 'rotate-5',
    },
    {
      line1: 'Did you guess the',
      line2: 'ENTIRE alphabet?!',
      line2Size: 38,
      mistPrimary: '#ef4444',
      mistSecondary: '#f97316',
      borderColor: '#fb923c',
      accentStreak: '#ef4444',
      textGradStart: '#fef08a',
      textGradMid: '#fb923c',
      textGradEnd: '#f87171',
      line2Stroke: '#dc2626',
      tiltClass: '-rotate-5',
    },
    {
      line1: "OMG, that's brutal",
      line2: 'Delete the VOD! LoL',
      line2Size: 37,
      mistPrimary: '#e11d48',
      mistSecondary: '#facc15',
      borderColor: '#facc15',
      accentStreak: '#e11d48',
      textGradStart: '#fef08a',
      textGradMid: '#fb7185',
      textGradEnd: '#f43f5e',
      line2Stroke: '#be123c',
      tiltClass: 'rotate-4',
    },
    {
      line1: '8+ guesses?! Call',
      line2: 'an ambulance! LoL',
      line2Size: 38,
      mistPrimary: '#dc2626',
      mistSecondary: '#38bdf8',
      borderColor: '#ef4444',
      accentStreak: '#38bdf8',
      textGradStart: '#7dd3fc',
      textGradMid: '#ffffff',
      textGradEnd: '#f87171',
      line2Stroke: '#dc2626',
      tiltClass: '-rotate-4',
    },
    {
      line1: 'Absolute carnage...',
      line2: "OMG, that's terrible!",
      line2Size: 35,
      mistPrimary: '#b91c1c',
      mistSecondary: '#f97316',
      borderColor: '#f87171',
      accentStreak: '#fbbf24',
      textGradStart: '#fde047',
      textGradMid: '#f87171',
      textGradEnd: '#ef4444',
      line2Stroke: '#991b1b',
      tiltClass: 'rotate-3',
    },
    {
      line1: "We don't talk about",
      line2: 'this score... EVER!',
      line2Size: 38,
      mistPrimary: '#be123c',
      mistSecondary: '#d946ef',
      borderColor: '#fb7185',
      accentStreak: '#e879f9',
      textGradStart: '#f0abfc',
      textGradMid: '#fde047',
      textGradEnd: '#fb7185',
      line2Stroke: '#9f1239',
      tiltClass: '-rotate-6',
    },
    {
      line1: 'OMG, 8+ guesses?!',
      line2: 'Keyboard smash wins!',
      line2Size: 35,
      mistPrimary: '#ef4444',
      mistSecondary: '#a3e635',
      borderColor: '#d9ff2e',
      accentStreak: '#ef4444',
      textGradStart: '#d9ff2e',
      textGradMid: '#fde047',
      textGradEnd: '#ef4444',
      line2Stroke: '#dc2626',
      tiltClass: 'rotate-4',
    },
  ],
};

const lastPickedIdxByTier: Partial<Record<StickerTierKey, number>> = {};

function getTierForGuessCount(letterGuessesCount: number): StickerTierKey {
  if (letterGuessesCount <= 0) return 0;
  if (letterGuessesCount >= 8) return 8;
  return letterGuessesCount as StickerTierKey;
}

function pickRandomStickerForGuesses(letterGuessesCount: number): SprayStickerVariant {
  const tier = getTierForGuessCount(letterGuessesCount);
  const pool = STICKER_POOLS_BY_GUESSES[tier];
  if (pool.length <= 1) return pool[0];
  const prevIdx = lastPickedIdxByTier[tier] ?? -1;
  let idx = Math.floor(Math.random() * pool.length);
  if (idx === prevIdx) {
    idx = (idx + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
  }
  lastPickedIdxByTier[tier] = idx;
  return pool[idx];
}

interface WinModalProps {
  isOpen: boolean;
  puzzle: Puzzle;
  letterGuessesCount: number;
  showGrumpySprayBanner?: boolean;
  onClose: () => void;
  onSelectNext: () => void;
  onSelectRandom: () => void;
  onOpenArchive: () => void;
  onOpenLeaderboardPopup?: () => void;
}

export const WinModal: React.FC<WinModalProps> = ({
  isOpen,
  puzzle,
  letterGuessesCount,
  showGrumpySprayBanner = false,
  onClose,
  onSelectRandom,
  onOpenArchive,
  onOpenLeaderboardPopup,
}) => {
  const [sticker, setSticker] = useState<SprayStickerVariant>(() =>
    pickRandomStickerForGuesses(letterGuessesCount)
  );

  useEffect(() => {
    if (isOpen && showGrumpySprayBanner) {
      setSticker(pickRandomStickerForGuesses(letterGuessesCount));
    }
  }, [isOpen, showGrumpySprayBanner, letterGuessesCount, puzzle.id]);

  if (!isOpen) return null;

  // Star rating logic
  const getRating = (count: number) => {
    if (count === 0) {
      return { stars: 3, label: 'Flawless! 0-Guess Achievement', color: 'text-amber-500', isZero: true };
    }
    if (count <= 3) return { stars: 3, label: 'Mastermind!', color: 'text-amber-500', isZero: false };
    if (count <= 7) return { stars: 2, label: 'Word Detective!', color: 'text-purple-500', isZero: false };
    return { stars: 1, label: 'Puzzle Solved!', color: 'text-emerald-500', isZero: false };
  };

  const rating = getRating(letterGuessesCount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative max-w-lg w-full">
        {showGrumpySprayBanner && (
          <div
            role="status"
            aria-live="polite"
            className={`pointer-events-none select-none absolute -inset-x-4 sm:-inset-x-8 top-[16%] sm:top-[18%] z-30 ${sticker.tiltClass} animate-in zoom-in-95 fade-in duration-300 drop-shadow-[0_14px_24px_rgba(0,0,0,0.65)]`}
          >
            <svg
              viewBox="0 0 640 215"
              className="w-full h-auto overflow-visible"
              aria-label={`${sticker.line1} ${sticker.line2}`}
            >
              <defs>
                <filter id="thematix-spray-edge" x="-15%" y="-25%" width="130%" height="160%">
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.065 0.14"
                    numOctaves="4"
                    seed="17"
                    result="noise"
                  />
                  <feDisplacementMap
                    in="SourceGraphic"
                    in2="noise"
                    scale="14"
                    xChannelSelector="R"
                    yChannelSelector="G"
                  />
                </filter>
                <filter id="thematix-spray-mist" x="-20%" y="-30%" width="140%" height="170%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feTurbulence
                    type="fractalNoise"
                    baseFrequency="0.22"
                    numOctaves="3"
                    seed="9"
                    result="grain"
                  />
                  <feDisplacementMap
                    in="blur"
                    in2="grain"
                    scale="10"
                    xChannelSelector="R"
                    yChannelSelector="B"
                  />
                </filter>
                <linearGradient id="thematix-spray-fill" x1="0%" y1="0%" x2="100%" y2="12%">
                  <stop offset="0%" stopColor="#14081c" stopOpacity="0.96" />
                  <stop offset="50%" stopColor="#1e0a2b" stopOpacity="0.98" />
                  <stop offset="100%" stopColor="#120718" stopOpacity="0.96" />
                </linearGradient>
                <linearGradient id="thematix-spray-text" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={sticker.textGradStart} />
                  <stop offset="52%" stopColor={sticker.textGradMid} />
                  <stop offset="100%" stopColor={sticker.textGradEnd} />
                </linearGradient>
              </defs>

              {/* Soft neon aerosol overspray cloud */}
              <path
                d="M 28 72 C 130 34, 515 26, 616 62 C 632 95, 622 140, 602 152 C 475 170, 145 174, 34 156 C 14 132, 12 92, 28 72 Z"
                fill={sticker.mistPrimary}
                opacity="0.48"
                filter="url(#thematix-spray-mist)"
              />
              <path
                d="M 42 58 C 170 28, 490 36, 606 72 C 622 104, 608 142, 588 156 C 460 176, 150 166, 44 148 C 24 124, 24 84, 42 58 Z"
                fill={sticker.mistSecondary}
                opacity="0.34"
                filter="url(#thematix-spray-mist)"
              />

              {/* Main jagged spray-painted banner body */}
              <path
                d="M 26 62 L 154 44 L 315 50 L 490 38 L 614 54 L 626 98 L 610 144 L 468 154 L 296 149 L 136 158 L 20 142 L 12 96 Z"
                fill="url(#thematix-spray-fill)"
                stroke={sticker.borderColor}
                strokeWidth="4.5"
                strokeOpacity="0.88"
                filter="url(#thematix-spray-edge)"
              />

              {/* Secondary accent spray streak */}
              <path
                d="M 48 134 C 190 142, 435 138, 594 126"
                fill="none"
                stroke={sticker.accentStreak}
                strokeWidth="7"
                strokeLinecap="round"
                opacity="0.78"
                filter="url(#thematix-spray-edge)"
              />

              {/* Paint drips hanging off bottom of the sprayed banner */}
              <g fill={sticker.borderColor} opacity="0.92">
                <path d="M 96 150 C 94 168, 92 184, 96 191 C 100 197, 104 190, 102 180 C 101 169, 102 158, 102 150 Z" />
                <path d="M 218 148 C 216 160, 216 168, 220 173 C 223 176, 226 171, 225 163 C 224 156, 224 152, 224 148 Z" />
                <path d="M 526 146 C 524 166, 522 188, 527 196 C 531 202, 536 194, 534 182 C 532 169, 533 156, 533 146 Z" />
              </g>
              <g fill={sticker.accentStreak} opacity="0.9">
                <path d="M 152 152 C 150 165, 149 175, 153 180 C 156 184, 159 179, 158 171 C 157 163, 158 156, 158 152 Z" />
                <path d="M 404 149 C 402 168, 401 182, 405 188 C 409 193, 413 186, 411 176 C 410 166, 410 155, 410 149 Z" />
                <path d="M 578 140 C 577 154, 576 163, 580 168 C 583 172, 586 167, 585 159 C 584 151, 584 145, 584 140 Z" />
              </g>

              {/* Aerosol splatter dots around edges */}
              <g fill={sticker.borderColor} opacity="0.88">
                <circle cx="14" cy="54" r="3.2" />
                <circle cx="32" cy="36" r="2.2" />
                <circle cx="72" cy="30" r="2.8" />
                <circle cx="268" cy="24" r="2.1" />
                <circle cx="566" cy="28" r="3.4" />
                <circle cx="624" cy="40" r="2.6" />
                <circle cx="634" cy="128" r="2.8" />
                <circle cx="48" cy="172" r="2.6" />
                <circle cx="298" cy="176" r="2.4" />
                <circle cx="596" cy="176" r="3.1" />
              </g>
              <g fill={sticker.accentStreak} opacity="0.85">
                <circle cx="22" cy="162" r="3.6" />
                <circle cx="118" cy="24" r="2.4" />
                <circle cx="446" cy="22" r="3.1" />
                <circle cx="614" cy="164" r="2.5" />
                <circle cx="352" cy="178" r="2.9" />
                <circle cx="632" cy="72" r="2.2" />
                <circle cx="6" cy="112" r="2.4" />
              </g>

              {/* Stenciled spray-painted message */}
              <text
                x="320"
                y="93"
                textAnchor="middle"
                fill="#09030f"
                stroke="#09030f"
                strokeWidth="10"
                strokeLinejoin="round"
                fontFamily="'Marker Felt', 'Comic Sans MS', 'Impact', system-ui, sans-serif"
                fontWeight="900"
                fontSize={sticker.line1Size ?? 35}
                letterSpacing="0.5"
              >
                {sticker.line1}
              </text>
              <text
                x="320"
                y="93"
                textAnchor="middle"
                fill="url(#thematix-spray-text)"
                fontFamily="'Marker Felt', 'Comic Sans MS', 'Impact', system-ui, sans-serif"
                fontWeight="900"
                fontSize={sticker.line1Size ?? 35}
                letterSpacing="0.5"
              >
                {sticker.line1}
              </text>

              <text
                x="320"
                y="134"
                textAnchor="middle"
                fill="#09030f"
                stroke="#09030f"
                strokeWidth="11"
                strokeLinejoin="round"
                fontFamily="'Marker Felt', 'Comic Sans MS', 'Impact', system-ui, sans-serif"
                fontWeight="900"
                fontSize={sticker.line2Size ?? 41}
                letterSpacing="1"
              >
                {sticker.line2}
              </text>
              <text
                x="320"
                y="134"
                textAnchor="middle"
                fill="#ffffff"
                stroke={sticker.line2Stroke}
                strokeWidth="1.6"
                fontFamily="'Marker Felt', 'Comic Sans MS', 'Impact', system-ui, sans-serif"
                fontWeight="900"
                fontSize={sticker.line2Size ?? 41}
                letterSpacing="1"
              >
                {sticker.line2}
              </text>
            </svg>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full p-6 text-center relative overflow-hidden">
          {/* Confetti header graphic */}
          <div className="absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r from-[#f5b82e] via-purple-600 to-[#ffd166]" />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-40 p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close to view board"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Trophy icon */}
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-amber-100 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center shadow-inner border border-amber-300/40">
            <Trophy className="w-9 h-9 stroke-[2.2]" />
          </div>

          <h3 className="text-2xl font-serif-title font-bold text-slate-900 dark:text-white">
            Brilliant Solving!
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {puzzle.formattedDate}
          </p>

        {/* Rating stars with spinning 100% larger logo on either side with a 20px gap */}
        <div className="flex items-center justify-center my-4 gap-[20px]">
          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt="The Missing Piece Logo"
            className="w-32 h-32 sm:w-40 sm:h-40 shrink-0 object-contain drop-shadow-md select-none animate-[spin_4s_linear_infinite]"
          />
          <div className="flex items-center justify-center gap-1.5 shrink-0">
            {[1, 2, 3].map((star) => (
              <Star
                key={star}
                className={`w-7 h-7 ${
                  star <= rating.stars
                    ? 'text-amber-400 fill-amber-400 scale-105'
                    : 'text-slate-200 dark:text-slate-700'
                }`}
              />
            ))}
          </div>
          <img
            src="/assets/aistudio/3d_logo_944e5372.png"
            alt="The Missing Piece Logo"
            className="w-32 h-32 sm:w-40 sm:h-40 shrink-0 object-contain drop-shadow-md select-none animate-[spin_4s_linear_infinite]"
          />
        </div>
        <div
          className={`text-sm font-bold mb-4 flex items-center justify-center gap-1.5 ${
            rating.isZero
              ? 'text-amber-500 dark:text-amber-400'
              : 'text-slate-800 dark:text-slate-200'
          }`}
        >
          {rating.isZero && <Crown className="w-4 h-4 fill-amber-400 text-amber-500" />}
          <span>{rating.label}</span>
        </div>

        {/* Score metrics */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div
            className={`p-3 rounded-2xl border ${
              rating.isZero
                ? 'bg-gradient-to-b from-amber-100 to-amber-50 dark:from-amber-950/60 dark:to-amber-900/30 border-amber-400/70 shadow-sm'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-100 dark:border-slate-800'
            }`}
          >
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Letter Guesses
            </span>
            <span className="text-2xl font-bold font-mono text-amber-500 dark:text-amber-400 inline-flex items-center justify-center gap-1">
              {rating.isZero && <Crown className="w-5 h-5 fill-amber-400/40" />}
              {letterGuessesCount}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
              Words Solved
            </span>
            <span className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">
              6 / 6
            </span>
          </div>
        </div>

        {/* Fun Fact / Trivia Card */}
        {puzzle.funFact && (
          <div className="text-left bg-purple-50/60 dark:bg-purple-950/20 p-3.5 rounded-2xl border border-purple-100 dark:border-purple-900/40 mb-5">
            <div className="flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5 text-[#f5b82e]" />
              <span>Theme Trivia</span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {puzzle.funFact}
            </p>
          </div>
        )}

        {/* View Game Button (Closes popup to view completed board) */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3.5 px-4 rounded-xl font-black text-sm bg-gradient-to-r from-[#f5b82e] via-[#ffd166] to-[#f5b82e] hover:brightness-105 active:scale-98 text-[#220536] flex items-center justify-center gap-2 shadow-md shadow-amber-500/25 transition-all cursor-pointer mb-2.5 border border-amber-300"
        >
          <Eye className="w-4 h-4 text-[#220536]" />
          <span>View Game</span>
        </button>

        {onOpenLeaderboardPopup && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLeaderboardPopup();
            }}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#2B0938] text-[#F6C915] hover:opacity-95 flex items-center justify-center gap-1.5 transition-opacity cursor-pointer mb-2.5"
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>View Thematix Leaderboard</span>
          </button>
        )}

        {/* Next / Archive actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenArchive();
            }}
            className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Select Date</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectRandom();
            }}
            className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Random Puzzle</span>
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};
