export type AreaLevel = 'PROVINCE' | 'DISTRICT' | 'WARD';

export interface AreaNode {
  id: string;
  name: string;
  slug: string;
  level: AreaLevel;
  ktvCount: number;
  /** Backend quyết định ngưỡng index, frontend không tự so sánh với con số riêng. */
  indexable: boolean;
  children: AreaNode[];
}

export interface AreaDetail extends Omit<AreaNode, 'children'> {
  parent: AreaNode | null;
  children: AreaNode[];
  siblings: AreaNode[];
}

export interface SearchItem {
  id: string;
  fullName: string;
  slug: string;
  yearsExperience: number;
  ratingAvg: number;
  ratingCount: number;
  isOnline: boolean;
  /** Null khi tìm theo khu vực (không có toạ độ khách). */
  distanceM: number | null;
  boostPoints: number;
  baseScore: number;
  score: number;
  lat: number;
  lon: number;
}

export interface SearchResponse {
  items: SearchItem[];
  page: number;
  size: number;
  total: number;
}

export interface ServiceItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export interface KtvServiceItem {
  serviceId: string;
  name: string;
  slug: string;
  priceFrom: number;
  durationMin: number;
}

export interface PublicKtvProfile {
  id: string;
  fullName: string;
  slug: string;
  bio: string | null;
  yearsExperience: number;
  lat: number;
  lon: number;
  serviceRadiusKm: number;
  ratingAvg: number;
  ratingCount: number;
  isOnline: boolean;
  createdAt: string;
  certifications: {
    id: string;
    name: string;
    issuingOrg: string | null;
    issuedAt: string | null;
  }[];
  coverageAreas: { id: string; name: string; slug: string; level: AreaLevel; provinceSlug: string | null }[];
  services: KtvServiceItem[];
}

export interface ReviewItem {
  id: string;
  ktvId: string;
  rating: number;
  comment: string | null;
  status: string;
  createdAt: string;
}

export interface ReviewList {
  items: ReviewItem[];
  page: number;
  size: number;
  total: number;
}

export interface Sitemap {
  ktv: { path: string; lastModified: string }[];
  areas: { path: string; province: string; district: string | null; ktvCount: number }[];
  services: { path: string }[];
  minKtvForIndex: number;
}
