/** Where a project's own page is: `/project`, with the project's id in `?id=`. */
export const PROJECT_ROUTE = '/project'

export const projectRoute = (id: string) => `${PROJECT_ROUTE}?id=${encodeURIComponent(id)}`
