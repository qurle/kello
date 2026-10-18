export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

export const scrollBehavior = (): ScrollBehavior => (reducedMotion.matches ? 'auto' : 'smooth')
