export function AuthField({
  id,
  name,
  type,
  label,
  placeholder,
  required,
  autoComplete,
}: {
  id: string
  name: string
  type: string
  label: string
  placeholder: string
  required?: boolean
  autoComplete?: string
}) {
  return (
    <div>
      <label
        className="mb-1.5 block font-sans text-[11px] font-semibold uppercase tracking-[0.15em] text-cream/50"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="motion-cinema w-full rounded-xl border border-white/10 bg-void/70 px-4 py-3 font-sans text-cream outline-none placeholder:text-cream/30 focus:border-brasil-gold"
      />
    </div>
  )
}
