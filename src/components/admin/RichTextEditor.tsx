import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Extension, Mark } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Youtube from "@tiptap/extension-youtube";
import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Undo,
  Redo,
  Minus,
  Upload,
  Loader2,
  Video,
  Youtube as YoutubeIcon,
  MoreHorizontal,
  Palette,
  Highlighter,
  RemoveFormatting,
  AlignJustify,
  Smile,
  Pilcrow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const ToolbarButton = ({
  onClick,
  isActive,
  disabled,
  icon: Icon,
  tooltip,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  icon: React.ElementType;
  tooltip: string;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Toggle
        size="sm"
        pressed={isActive}
        onMouseDown={(event) => event.preventDefault()}
      onPressedChange={onClick}
        disabled={disabled}
        className="data-[state=on]:bg-accent data-[state=on]:text-white"
      >
        <Icon className="h-4 w-4" />
      </Toggle>
    </TooltipTrigger>
    <TooltipContent side="bottom">
      <p>{tooltip}</p>
    </TooltipContent>
  </Tooltip>
);



// blogFormatToolbarV2: formatação adicional de texto.
const BlogTextStyle = Mark.create({
  name: "blogTextStyle",

  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: element => element.style.color || null,
        renderHTML: attrs =>
          attrs.color ? { style: `color: ${attrs.color}` } : {},
      },
      fontSize: {
        default: null,
        parseHTML: element => element.style.fontSize || null,
        renderHTML: attrs =>
          attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
      },
      backgroundColor: {
        default: null,
        parseHTML: element => element.style.backgroundColor || null,
        renderHTML: attrs =>
          attrs.backgroundColor
            ? { style: `background-color: ${attrs.backgroundColor}` }
            : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[style]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["span", HTMLAttributes, 0];
  },
});

// Mantém a numeração contínua entre listas ordenadas
// separadas por parágrafos ou outros blocos de conteúdo.
const ContinuousOrderedList = Extension.create({
  name: "continuousOrderedList",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) {
            return null;
          }

          let nextNumber = 1;
          const tr = newState.tr;

          newState.doc.forEach((node, offset) => {
            if (node.type.name !== "orderedList") {
              return;
            }

            if (node.attrs.start !== nextNumber) {
              tr.setNodeMarkup(offset, undefined, {
                ...node.attrs,
                start: nextNumber,
              });
            }

            nextNumber += node.childCount;
          });

          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});

export function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [fontSize, setFontSize] = useState("16px");
  const [textColor, setTextColor] = useState("#243447");
  const [highlightColor, setHighlightColor] = useState("#fff2a8");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadType, setUploadType] = useState<"image" | "video" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      ContinuousOrderedList,
      BlogTextStyle,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-accent underline hover:text-accent/80",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-lg max-w-full mx-auto my-4",
        },
      }),
      Youtube.configure({
        controls: true,
        nocookie: true,
        HTMLAttributes: {
          class: "w-full aspect-video rounded-lg my-4",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-lg max-w-none min-h-[400px] focus:outline-none p-4 prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-a:text-accent",
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt("URL do link:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  };

  const addImageByUrl = () => {
    const url = window.prompt("URL da imagem:");
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máximo 5MB)");
      return;
    }

    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("blog")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("blog")
        .getPublicUrl(filePath);

      editor.chain().focus().setImage({ src: publicUrl }).run();
      toast.success("Imagem inserida com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao fazer upload", { description: error.message });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const addYoutubeVideo = () => {
    const url = window.prompt("URL do vídeo do YouTube:");
    if (url) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Por favor, selecione um vídeo");
      return;
    }

    // 50MB limit for videos
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Vídeo muito grande (máximo 50MB)");
      return;
    }

    setIsUploading(true);
    setUploadType("video");

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `videos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("blog")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("blog")
        .getPublicUrl(filePath);

      // Insert video as HTML since Tiptap doesn't have native video support
      editor.chain().focus().insertContent(`
        <div class="video-wrapper my-4">
          <video controls class="w-full rounded-lg">
            <source src="${publicUrl}" type="${file.type}">
            Seu navegador não suporta vídeos.
          </video>
        </div>
      `).run();
      
      toast.success("Vídeo inserido com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao fazer upload", { description: error.message });
    } finally {
      setIsUploading(false);
      setUploadType(null);
      if (videoInputRef.current) {
        videoInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="border border-border rounded-xl overflow-visible bg-background">
      {/* Toolbar */}
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-1 p-2 border-b border-border bg-background shadow-sm rounded-t-xl">
        {/* Undo/Redo */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          icon={Undo}
          tooltip="Desfazer"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          icon={Redo}
          tooltip="Refazer"
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive("heading", { level: 1 })}
          icon={Heading1}
          tooltip="Título 1"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive("heading", { level: 2 })}
          icon={Heading2}
          tooltip="Título 2"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive("heading", { level: 3 })}
          icon={Heading3}
          tooltip="Título 3"
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Text Formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
          icon={Bold}
          tooltip="Negrito"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
          icon={Italic}
          tooltip="Itálico"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive("underline")}
          icon={UnderlineIcon}
          tooltip="Sublinhado"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
          icon={Strikethrough}
          tooltip="Riscado"
        />

        <Separator orientation="vertical" className="h-6 mx-1" />


        {/* Ferramentas de formatação principais */}
        <Separator orientation="vertical" className="h-6 mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm"
              className="h-8 px-2 text-xs">
              {fontSize} ▾
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {["12px","14px","16px","18px","20px","24px","28px","32px"].map(size => (
              <DropdownMenuItem key={size}
                onSelect={() => {
                  editor.chain().focus().setMark("blogTextStyle", {
                    fontSize: size,
                  }).run();
                  setFontSize(size);
                }}>
                {size}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <label
          title="Cor do texto"
          className="relative flex items-center justify-center h-8 w-9 rounded-md hover:bg-accent cursor-pointer"
          onMouseDown={event => event.preventDefault()}
        >
          <Palette className="w-4 h-4" />
          <span className="absolute bottom-1 w-4 h-0.5"
            style={{ backgroundColor: textColor }} />
          <input type="color" value={textColor}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            onChange={event => {
              setTextColor(event.target.value);
              editor.chain().focus().setMark("blogTextStyle", {
                color: event.target.value,
              }).run();
            }} />
        </label>

        <label title="Realçar texto"
          className="relative flex items-center justify-center h-8 w-9 rounded-md hover:bg-accent cursor-pointer"
          onMouseDown={event => event.preventDefault()}>
          <Highlighter className="w-4 h-4" />
          <span className="absolute bottom-1 w-4 h-0.5"
            style={{ backgroundColor: highlightColor }} />
          <input type="color" value={highlightColor}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            onChange={event => {
              setHighlightColor(event.target.value);
              editor.chain().focus().setMark("blogTextStyle", {
                backgroundColor: event.target.value,
              }).run();
            }} />
        </label>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm"
              className="h-8 px-2 text-xs gap-1">
              <Pilcrow className="h-4 w-4" />
              Parágrafo
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem
              onSelect={() => editor.chain().focus().setParagraph().run()}>
              Parágrafo normal
            </DropdownMenuItem>
            {[1,2,3].map(level => (
              <DropdownMenuItem key={level}
                onSelect={() => editor.chain().focus().toggleHeading({
                  level: level as 1 | 2 | 3,
                }).run()}>
                H{level}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          title="Mais ferramentas"
          aria-label="Mais ferramentas"
          aria-expanded={moreOpen}
          onMouseDown={event => event.preventDefault()}
          onClick={() => setMoreOpen(!moreOpen)}
          className="h-8 w-9"
        >
          <MoreHorizontal className="h-5 w-5" />
        </Button>

        {moreOpen && (
          <div className="w-full flex flex-wrap items-center gap-1 border-t border-border pt-2 mt-2">
        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          isActive={editor.isActive({ textAlign: "left" })}
          icon={AlignLeft}
          tooltip="Alinhar à esquerda"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          isActive={editor.isActive({ textAlign: "center" })}
          icon={AlignCenter}
          tooltip="Centralizar"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          isActive={editor.isActive({ textAlign: "right" })}
          icon={AlignRight}
          tooltip="Alinhar à direita"
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive("bulletList")}
          icon={List}
          tooltip="Lista com marcadores"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive("orderedList")}
          icon={ListOrdered}
          tooltip="Lista numerada"
        />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive("blockquote")}
          icon={Quote}
          tooltip="Citação"
        />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Media */}
        <ToolbarButton
          onClick={addLink}
          isActive={editor.isActive("link")}
          icon={LinkIcon}
          tooltip="Inserir link"
        />
        
        {/* Image dropdown with upload option */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Toggle size="sm" className="data-[state=on]:bg-accent data-[state=on]:text-white">
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                </Toggle>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Inserir imagem</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Fazer upload
            </DropdownMenuItem>
            <DropdownMenuItem onClick={addImageByUrl}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Inserir por URL
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Video dropdown */}
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoUpload}
          className="hidden"
        />
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Toggle size="sm" className="data-[state=on]:bg-accent data-[state=on]:text-white">
                  {isUploading && uploadType === "video" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Video className="h-4 w-4" />
                  )}
                </Toggle>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Inserir vídeo</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={addYoutubeVideo}>
              <YoutubeIcon className="h-4 w-4 mr-2" />
              YouTube
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Fazer upload
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          icon={Minus}
          tooltip="Linha horizontal"
        />

            <Separator orientation="vertical" className="h-6 mx-1" />

            <ToolbarButton
              onClick={() => editor.chain().focus().setTextAlign("justify").run()}
              isActive={editor.isActive({ textAlign: "justify" })}
              icon={AlignJustify}
              tooltip="Justificar texto"
            />

            <ToolbarButton
              onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
              icon={RemoveFormatting}
              tooltip="Limpar formatação"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon"
                  className="h-8 w-9" title="Inserir emoji">
                  <Smile className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start"
                className="grid grid-cols-6 gap-1 p-2">
                {["😀","😊","😍","👏","👍","❤️",
                  "✨","⭐","✅","💡","📌","🎯",
                  "🌿","💪","🧠","🎉","📚","🚀"].map(emoji => (
                  <DropdownMenuItem key={emoji}
                    className="justify-center cursor-pointer text-lg p-1"
                    onSelect={() => editor.chain().focus()
                      .insertContent(emoji).run()}>
                    {emoji}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}