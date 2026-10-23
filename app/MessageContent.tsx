import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MessageContentProps = { content: string };

export const MessageContent = ({ content }: MessageContentProps) => (
  <div className="MessageContent">
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  </div>
);
