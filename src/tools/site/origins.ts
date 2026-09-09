export const captureOrigin = typeof __CAPTURE_ORIGIN__ === 'string' ? __CAPTURE_ORIGIN__ : 'https://capture.exalto.ai';
export const websiteOrigin = typeof __WEBSITE_ORIGIN__ === 'string' ? __WEBSITE_ORIGIN__ : 'https://exalto.ai';
export const captureHref = (path: string) => new URL(path, captureOrigin).href;
export const websiteHref = (path: string) => new URL(path, websiteOrigin).href;
