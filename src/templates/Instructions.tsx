import { useTranslations } from 'next-intl';
import { Background } from '@/components/Background';
import { Section } from '@/features/landing/Section';

export const Instructions = () => {
  const t = useTranslations('Instructions');

  const steps = [
    {
      num: '01',
      title: t('step1_title'),
      desc: t('step1_desc'),
      code: '// Preparar memoria del proyecto #roadmap',
    },
    {
      num: '02',
      title: t('step2_title'),
      desc: t('step2_desc'),
      code: '@ana coordinar reunión técnica #arquitectura',
    },
    {
      num: '03',
      title: t('step3_title'),
      desc: t('step3_desc'),
      code: '// Entrega de documentación técnica el viernes a las 12',
    },
  ];

  const tips = [
    { title: t('tip1_title'), desc: t('tip1_desc') },
    { title: t('tip2_title'), desc: t('tip2_desc') },
    { title: t('tip3_title'), desc: t('tip3_desc') },
  ];

  return (
    <Background>
      <Section
        subtitle={t('section_subtitle')}
        title={t('section_title')}
        description={t('section_description')}
      >
        {/* Pasos de Instrucciones */}
        <div className="
          grid grid-cols-1 gap-6
          md:grid-cols-3
        "
        >
          {steps.map(step => (
            <div
              key={step.num}
              className="
                relative flex flex-col justify-between rounded-2xl border
                border-border/70 bg-card p-6 shadow-xs transition-all
                hover:border-primary/40 hover:shadow-md
              "
            >
              <div>
                <span className="
                  text-3xl font-extrabold tracking-tight text-primary/30
                "
                >
                  {step.num}
                </span>
                <h3 className="mt-2 text-base font-bold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs/relaxed text-muted-foreground">
                  {step.desc}
                </p>
              </div>

              <div className="
                mt-4 rounded-xl border border-border/50 bg-muted/40 p-2.5
                font-mono text-[11px] text-primary
              "
              >
                {step.code}
              </div>
            </div>
          ))}
        </div>

        {/* Consejos Rápidos */}
        <div className="
          mt-8 grid grid-cols-1 gap-4
          sm:grid-cols-3
        "
        >
          {tips.map(tip => (
            <div
              key={tip.title}
              className="
                rounded-xl border border-border/50 bg-muted/20 p-4
                transition-all
                hover:bg-muted/40
              "
            >
              <h4 className="text-xs font-bold text-foreground">
                {tip.title}
              </h4>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {tip.desc}
              </p>
            </div>
          ))}
        </div>
      </Section>
    </Background>
  );
};
