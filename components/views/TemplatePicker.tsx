import {
  ACTION_TEMPLATES,
  PLACE_DICTIONARY,
  templateById,
  type ActionTemplate,
} from "@/lib/views";

export default function TemplatePicker({
  value,
  onChange,
  conflicts,
  districtId,
}: {
  value: string;
  onChange: (id: string) => void;
  conflicts: string[];
  districtId: string;
}) {
  const selected = templateById(value);
  const place = PLACE_DICTIONARY[districtId];

  return (
    <fieldset className="space-y-2">
      <legend className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Шаблон действия
      </legend>
      <div className="space-y-1">
        {ACTION_TEMPLATES.map((template) => (
          <TemplateRow
            key={template.id}
            template={template}
            checked={template.id === value}
            onChange={onChange}
          />
        ))}
      </div>
      {selected && (
        <blockquote className="rounded-md border border-white/10 bg-black/30 p-2 text-[11px] leading-relaxed text-muted-foreground">
          {selected.prompt}
        </blockquote>
      )}
      <div className="rounded-md border border-white/10 p-2 text-[11px] text-muted-foreground">
        {place ? (
          <>
            <div className="text-foreground">Словарь · {place.name}</div>
            <div>Можно: {place.materials.join(", ")}.</div>
            <div>Нельзя: {place.forbidden.join(", ")}.</div>
          </>
        ) : (
          <div>Для этого района словарь места не задан. Жёсткие шаблоны не блокируются.</div>
        )}
      </div>
      {conflicts.length > 0 && (
        <div className="rounded-md border border-amber-300/40 bg-amber-500/10 p-2 text-[11px] text-amber-100">
          {conflicts.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function TemplateRow({
  template,
  checked,
  onChange,
}: {
  template: ActionTemplate;
  checked: boolean;
  onChange: (id: string) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-white/[0.04]">
      <input
        type="radio"
        name="view-template"
        value={template.id}
        checked={checked}
        onChange={() => onChange(template.id)}
      />
      <span>{template.label}</span>
    </label>
  );
}
