import { StickyBanner } from '@/features/landing/StickyBanner';
import { Link } from '@/libs/I18nNavigation';

export const DemoBanner = () => (
  <StickyBanner>
    🧪 Entorno de Pruebas Alpha (Base de datos volátil · Duración 1 mes) -
    {' '}
    <Link href="/sign-up">Acceder a la Evaluación</Link>
  </StickyBanner>
);
