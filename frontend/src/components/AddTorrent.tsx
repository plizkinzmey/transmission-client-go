import React, { useState, useRef } from "react";
import {
  Dialog,
  Button,
  Tabs,
  Flex,
  Text,
  Box,
  TextField,
} from "@radix-ui/themes";
import { useLocalization } from "../contexts/LocalizationContext";
import { LoadingSpinner } from "./LoadingSpinner";
import { FolderIcon } from "@heroicons/react/24/outline";
import { Portal } from "./Portal";

interface AddTorrentProps {
  onAdd: (url: string) => void;
  onAddFile: (base64Content: string) => void;
  onClose: () => void;
}

const FileInputArea = ({
  isDragOver,
  ...props
}: { isDragOver?: boolean } & React.HTMLAttributes<HTMLDivElement>) => (
  <Box
    {...props}
    style={{
      border: "2px dashed var(--gray-6)",
      borderRadius: "8px",
      padding: "24px",
      textAlign: "center",
      cursor: "pointer",
      transition: "all 0.2s ease",
      background: isDragOver ? "var(--gray-3)" : "transparent",
    }}
    onMouseEnter={(e) => {
      const target = e.currentTarget as HTMLDivElement;
      target.style.borderColor = "var(--accent-9)";
      target.style.background = "var(--gray-3)";
    }}
    onMouseLeave={(e) => {
      const target = e.currentTarget as HTMLDivElement;
      target.style.borderColor = "var(--gray-6)";
      target.style.background = isDragOver ? "var(--gray-3)" : "transparent";
    }}
  />
);

export const AddTorrent: React.FC<AddTorrentProps> = ({
  onAdd,
  onAddFile,
  onClose,
}) => {
  const { t, isLoading: isLocalizationLoading } = useLocalization();
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState<"url" | "file">("url");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "url" && url.trim()) {
      onAdd(url.trim());
      onClose();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = (file: File) => {
    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const base64Content = reader.result as string;
      const base64Data = base64Content.split(",")[1];
      onAddFile(base64Data);
      onClose();
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file?.name?.endsWith(".torrent")) {
      handleFile(file);
    }
  };

  return (
    <Portal>
      <Dialog.Root open onOpenChange={() => onClose()}>
        <Dialog.Content style={{ maxWidth: 500 }}>
          <Dialog.Title mb="4">{t("add.title")}</Dialog.Title>

          {isLocalizationLoading ? (
            <Flex justify="center" p="6">
              <LoadingSpinner size="medium" />
            </Flex>
          ) : (
            <form onSubmit={handleSubmit}>
              <Tabs.Root
                value={activeTab}
                onValueChange={(value) => setActiveTab(value as "url" | "file")}
              >
                <Tabs.List>
                  <Tabs.Trigger value="url">{t("add.url")}</Tabs.Trigger>
                  <Tabs.Trigger value="file">{t("add.file")}</Tabs.Trigger>
                </Tabs.List>

                <Box mt="4">
                  <Tabs.Content value="url">
                    <Flex
                      direction="column"
                      gap="2"
                      style={{ maxWidth: "400px", margin: "0 auto" }}
                    >
                      <TextField.Root
                        size="1"
                        placeholder="magnet:?xt=urn:btih:..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="rt-center"
                      />
                    </Flex>
                  </Tabs.Content>

                  <Tabs.Content value="file">
                    <Flex direction="column" gap="2">
                      <FileInputArea
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        isDragOver={isDragOver}
                      >
                        <FolderIcon
                          style={{
                            width: "32px",
                            height: "32px",
                            color: "var(--gray-9)",
                            margin: "0 auto 12px",
                          }}
                        />
                        <Text as="div" size="2" mb="1">
                          {t("add.dropFile")}
                        </Text>
                        <Text as="div" size="1" color="gray">
                          {t("add.orClickToSelect")}
                        </Text>
                      </FileInputArea>

                      {selectedFileName && (
                        <Box
                          mt="2"
                          p="2"
                          style={{
                            background: "var(--gray-3)",
                            borderRadius: "6px",
                          }}
                        >
                          <Text size="2">{selectedFileName}</Text>
                        </Box>
                      )}

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".torrent"
                        onChange={handleFileChange}
                        style={{ display: "none" }}
                      />
                    </Flex>
                  </Tabs.Content>
                </Box>
              </Tabs.Root>

              <Flex justify="end" gap="3" mt="4">
                <Button size="1" variant="soft" onClick={onClose}>
                  {t("add.cancel")}
                </Button>
                {activeTab === "url" && (
                  <Button size="1" type="submit" disabled={!url.trim()}>
                    {t("add.add")}
                  </Button>
                )}
              </Flex>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Root>
    </Portal>
  );
};
