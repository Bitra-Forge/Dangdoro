import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
    content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                a: ({ href, children }) => (
                    <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition-colors"
                    >
                        {children}
                    </a>
                ),
                code: ({ children, className }) => {
                    const isInline = !className;
                    if (isInline) {
                        return (
                            <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 text-xs font-mono">
                                {children}
                            </code>
                        );
                    }
                    return (
                        <pre className="p-3 rounded-xl bg-zinc-900 border border-white/5 overflow-x-auto my-2">
                            <code className="text-xs font-mono text-zinc-300">
                                {children}
                            </code>
                        </pre>
                    );
                },
                blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-zinc-700 pl-3 my-2 text-zinc-400 italic">
                        {children}
                    </blockquote>
                ),
                ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-0.5 my-1 text-zinc-300">
                        {children}
                    </ul>
                ),
                ol: ({ children }) => (
                    <ol className="list-decimal list-inside space-y-0.5 my-1 text-zinc-300">
                        {children}
                    </ol>
                ),
                strong: ({ children }) => (
                    <strong className="font-bold text-white">{children}</strong>
                ),
                em: ({ children }) => (
                    <em className="italic text-zinc-200">{children}</em>
                ),
                p: ({ children }) => (
                    <p className="text-sm text-zinc-300 break-words">{children}</p>
                ),
            }}
        >
            {content}
        </ReactMarkdown>
    );
}
