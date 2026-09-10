export interface NewsItem {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
}

export interface NewsData {
  configured: boolean;
  items?: NewsItem[];
  error?: string;
}
