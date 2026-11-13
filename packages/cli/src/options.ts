import { CLI } from './main'

export type Option = (opts: {[key: string]: any}, app: CLI) => boolean

export const options: Option[] = [];