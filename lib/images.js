const BASE_REGEX = /(upload\/)(v\d+\/)/

export function getOptimizedUrl(url, width) {
  if (!url?.includes('res.cloudinary.com')) return url
  const transformation = `w_${width},f_auto,q_auto/`
  return url.replace(BASE_REGEX, `$1${transformation}$2`)
}
