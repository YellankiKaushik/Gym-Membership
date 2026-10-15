import gym1 from '../assets/gym/gym1.jpg';
import gym2 from '../assets/gym/gym2.jpg';
import gym3 from '../assets/gym/gym3.jpg';
import { MEMBERSHIP_PLANS } from '../utils/membership';

const installation = typeof __GYM_PUBLIC_CONFIG__ !== 'undefined' ? __GYM_PUBLIC_CONFIG__ : {};
export const gymConfig = {
  gym: { name: installation.name || 'FitZone', tagline: installation.tagline || 'Strength · Discipline · Consistency',
    description: installation.description || 'Build strength, stay consistent, and feel your best.' },
  trainer: { name: installation.trainerName || 'Kiran', title: installation.trainerTitle || 'Certified Trainer' },
  address: { label: installation.address || 'Dilsukhnagar, Hyderabad',
    mapLink: installation.mapUrl || 'https://maps.google.com/?q=Dilsukhnagar+Hyderabad' },
  logo: installation.logoUrl || '',
  gallery: installation.galleryImages?.split(',').map(url => url.trim()).filter(Boolean) || [gym1, gym2, gym3],
  contact: { phone: installation.contactPhone || '', email: installation.contactEmail || '' },
  plans: MEMBERSHIP_PLANS.map(title => ({ title })),
};
