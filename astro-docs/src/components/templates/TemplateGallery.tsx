import { useState, type CSSProperties } from 'react';
import type { Template, TemplateCategory } from '../../data/templates';

interface Props {
  templates: Template[];
  categories: TemplateCategory[];
}

function accentStyle(t: Template): CSSProperties {
  return {
    '--tpl-accent': t.accent,
    '--tpl-accent-to': t.accentTo,
  } as unknown as CSSProperties;
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <a
      className="tpl-card"
      href={`/docs/templates/${template.slug}`}
      style={accentStyle(template)}
    >
      <div
        className={template.image ? 'tpl-thumb tpl-thumb--img' : 'tpl-thumb'}
      >
        {template.image ? (
          <img
            className="tpl-thumb-img"
            src={template.image}
            alt={`${template.name} template preview`}
            loading="lazy"
          />
        ) : (
          <span className="tpl-thumb-word">{template.glyph}</span>
        )}
      </div>
      <div className="tpl-card-body">
        <div className="tpl-card-head">
          <h3 className="tpl-card-title">{template.name}</h3>
        </div>
        <span className="tpl-card-meta">{template.category}</span>
      </div>
    </a>
  );
}

export function TemplateGallery({ templates, categories }: Props) {
  const [active, setActive] = useState<'All' | TemplateCategory>('All');

  const filtered =
    active === 'All'
      ? templates
      : templates.filter((t) => t.category === active);

  return (
    <div>
      <div className="tpl-controls">
        <div className="tpl-chips" role="group" aria-label="Filter by category">
          <button
            type="button"
            className="tpl-chip"
            aria-pressed={active === 'All'}
            onClick={() => setActive('All')}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              className="tpl-chip"
              aria-pressed={active === c}
              onClick={() => setActive(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <p className="tpl-count">
        {filtered.length} {filtered.length === 1 ? 'template' : 'templates'}
      </p>

      {filtered.length > 0 ? (
        <div className="tpl-grid">
          {filtered.map((t) => (
            <TemplateCard key={t.slug} template={t} />
          ))}
        </div>
      ) : (
        <p className="tpl-empty">No templates in this category yet.</p>
      )}
    </div>
  );
}

export default TemplateGallery;
