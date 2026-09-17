import { CloudSun, Sun, CloudRain, CloudFog } from 'lucide-react';

/**
 * WeatherIcon — static component wrapper that avoids creating component types during render.
 */
export function WeatherIcon({ description = '', size = 20, className = '', ...props }) {
  const d = (description || '').toLowerCase();
  if (d.includes('rain') || d.includes('drizzle') || d.includes('thunder')) {
    return <CloudRain size={size} className={className} {...props} />;
  }
  if (d.includes('fog') || d.includes('haze') || d.includes('mist')) {
    return <CloudFog size={size} className={className} {...props} />;
  }
  if (d.includes('cloud')) {
    return <CloudSun size={size} className={className} {...props} />;
  }
  return <Sun size={size} className={className} {...props} />;
}

export default WeatherIcon;
