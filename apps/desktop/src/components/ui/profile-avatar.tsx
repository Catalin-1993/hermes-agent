import { profileColorSoft } from '@/lib/profile-color'
import { profileShortLabel } from '@/lib/profile-short-label'
import { cn } from '@/lib/utils'

/** A profile as a person: their photo when they chose one, else their initial on a soft tint of
 *  their colour. Round — the account row's mark; `ProfileGlyph` is the rail's square. */
export function ProfileAvatar({
  className,
  color,
  image,
  label,
  ...props
}: Omit<React.ComponentProps<'span'>, 'color'> & {
  color: null | string
  image?: null | string
  label: string
}) {
  return (
    <span
      className={cn(
        'grid size-7 shrink-0 place-items-center overflow-hidden rounded-full text-[0.75rem] font-semibold uppercase leading-none',
        className
      )}
      style={
        image
          ? undefined
          : { backgroundColor: profileColorSoft(color ?? 'var(--ui-text-quaternary)', 22), color: color ?? undefined }
      }
      {...props}
    >
      {image ? (
        <img alt="" className="size-full object-cover" draggable={false} src={image} />
      ) : (
        profileShortLabel(label)
      )}
    </span>
  )
}
