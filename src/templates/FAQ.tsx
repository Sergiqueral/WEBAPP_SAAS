import { useTranslations } from 'next-intl';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Section } from '@/features/landing/Section';

export const FAQ = () => {
  const t = useTranslations('FAQ');

  const faqItems = [
    { key: 'q1', question: t('q1'), answer: t('a1') },
    { key: 'q2', question: t('q2'), answer: t('a2') },
    { key: 'q3', question: t('q3'), answer: t('a3') },
    { key: 'q4', question: t('q4'), answer: t('a4') },
    { key: 'q5', question: t('q5'), answer: t('a5') },
    { key: 'q6', question: t('q6'), answer: t('a6') },
  ];

  return (
    <Section
      subtitle={t('section_subtitle')}
      title={t('section_title')}
      description={t('section_description')}
    >
      <Accordion type="multiple" className="w-full">
        {faqItems.map(item => (
          <AccordionItem key={item.key} value={item.key}>
            <AccordionTrigger className="text-left font-semibold">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="leading-relaxed text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
};
