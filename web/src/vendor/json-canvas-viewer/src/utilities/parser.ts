export default async function parser(markdown: string) {
	const [{ default: purify }, { marked }] = await Promise.all([
		import('dompurify'),
		import('marked'),
	]);
	return purify.sanitize(await marked(markdown));
}
