// Vite serves any file as a string with the `?raw` suffix. Declaring it here
// rather than pulling in @types/node keeps the ERB-reading test dependency-free.
declare module '*.erb?raw' {
  const contents: string
  export default contents
}
