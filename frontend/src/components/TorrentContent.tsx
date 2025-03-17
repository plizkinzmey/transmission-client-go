import React, { useState, useEffect } from "react";
import { useLocalization } from "../contexts/LocalizationContext";
import {
  ArrowPathIcon,
  XMarkIcon,
  ChevronDownIcon,
  FolderIcon,
  DocumentIcon,
} from "@heroicons/react/24/outline";
import styled from "@emotion/styled";
import styles from "../styles/TorrentContent.module.css";
import { GetTorrentFiles, SetFilesWanted } from "../../wailsjs/go/main/App";

interface TorrentContentProps {
  id: number;
  name: string;
  onClose: () => void;
}

interface TorrentFile {
  ID: number;
  Name: string;
  Path: string;
  Size: number;
  Progress: number;
  Wanted: boolean;
}

interface FileNode {
  ID: number;
  Name: string;
  Path: string;
  Size: number;
  Progress: number;
  Wanted: boolean;
  isDirectory?: boolean;
  children?: FileNode[];
  parent?: FileNode;
  expanded?: boolean;
}

// Styled components
const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--background-primary);
  z-index: 1000;
  padding: 20px;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid var(--border-color);
`;

const Title = styled.h2`
  margin: 0;
  color: var(--text-primary);
  font-size: 1.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: calc(100% - 50px);
`;

const Content = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: var(--background-primary);
  color: var(--text-primary);
`;

const FileTree = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const FileNodeContainer = styled.div<{ depth: number; isDirectory: boolean }>`
  margin-left: ${(props) => props.depth * 24}px;
  margin-bottom: 2px;
`;

const FileNodeContent = styled.div<{ isDirectory: boolean }>`
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) 120px 100px;
  gap: 8px;
  align-items: center;
  padding: 8px;
`;

const FileChildren = styled.div<{ isExpanded: boolean }>`
  display: ${(props) => (props.isExpanded ? "block" : "none")};
  margin-left: 27px;
`;

const ExpandButton = styled.button<{ isExpanded: boolean }>`
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  width: 24px;
  height: 24px;
  min-width: 24px;
  transform: rotate(${(props) => (props.isExpanded ? "0deg" : "-90deg")});

  svg {
    width: 16px;
    height: 16px;
  }
`;

const IconWrapper = styled.div<{ isDirectory: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: ${(props) =>
    props.isDirectory ? "var(--text-primary)" : "var(--text-secondary)"};

  svg {
    width: 20px;
    height: 20px;
  }
`;

const Checkbox = styled.input`
  margin: 0;
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--accent-color);
  border: 1px solid var(--tree-checkbox-border);
  background-color: var(--tree-checkbox-bg);

  &:indeterminate {
    accent-color: var(--accent-color);
  }
`;

const FileName = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 8px;
  color: var(--text-primary);
`;

const FileProgress = styled.div<{ progress: number }>`
  width: 100px;
  height: 4px;
  background-color: var(--tree-progress-bg);
  border-radius: 2px;
  position: relative;

  &::after {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    width: ${(props) => props.progress}%;
    background-color: var(--tree-progress-fill);
    border-radius: 2px;
  }
`;

const FileSize = styled.span`
  color: var(--text-secondary);
  font-size: 0.9rem;
  text-align: right;
  white-space: nowrap;
`;

const SelectAllContainer = styled.div`
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  padding: 8px;
  background-color: var(--background-secondary);
  border-radius: 4px;
`;

const SelectAllLabel = styled.span`
  margin-left: 8px;
  color: var(--text-primary);
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;

  svg {
    width: 24px;
    height: 24px;
  }

  &:hover {
    opacity: 0.8;
  }
`;

const processTreeNodes = (nodes: FileNode[]): FileNode[] => {
  return nodes.map((node) => {
    const newNode = { ...node };
    if (newNode.children?.length) {
      newNode.children = processTreeNodes(newNode.children);
      const childProgress = newNode.children.reduce(
        (sum, child) => sum + child.Progress,
        0
      );
      newNode.Progress = childProgress / newNode.children.length;
    }
    return newNode;
  });
};

const collectFileIds = (node: FileNode): number[] => {
  if (!node.isDirectory && node.ID >= 0) {
    return [node.ID];
  }
  if (node.children) {
    return node.children.flatMap(collectFileIds);
  }
  return [];
};

const updateNodesWanted = (
  nodes: FileNode[],
  targetNode: FileNode,
  wanted: boolean,
  fileIds: number[]
): FileNode[] => {
  return nodes.map((node) => {
    const newNode = { ...node };
    if (
      node === targetNode ||
      (node.isDirectory &&
        targetNode.isDirectory &&
        node.Path.startsWith(targetNode.Path)) ||
      fileIds.includes(node.ID)
    ) {
      newNode.Wanted = wanted;
    }
    if (node.children) {
      newNode.children = updateNodesWanted(
        node.children,
        targetNode,
        wanted,
        fileIds
      );
    }
    return newNode;
  });
};

const formatFileSize = (size: number | undefined): string => {
  // Проверка на undefined или отрицательные значения
  if (size === undefined || size < 0) {
    return "0.00 B";
  }

  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = size;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(2)} ${units[unitIndex]}`;
};

// Вспомогательная функция для создания узла дерева
const createNodeForPath = (
  file: TorrentFile,
  partName: string,
  fullPath: string,
  isFile: boolean
): FileNode => {
  return {
    ID: isFile ? file.ID : -1,
    Name: partName,
    Path: fullPath,
    Size: isFile ? file.Size : 0,
    Progress: isFile ? file.Progress : 0,
    Wanted: isFile ? file.Wanted : true,
    isDirectory: !isFile,
    children: !isFile ? [] : undefined,
    expanded: true, // По умолчанию все узлы развернуты
  };
};

// Вспомогательная функция для добавления узла к родителю
const addNodeToParent = (
  root: { [path: string]: FileNode },
  node: FileNode,
  parentPath: string
): void => {
  const parentNode = root[parentPath];
  if (parentNode?.children) {
    parentNode.children.push(node);
  }
};

// Вспомогательная функция для вычисления статистики директорий
const calculateDirStats = (
  node: FileNode
): { size: number; progressSum: number; count: number } => {
  if (!node.isDirectory || !node.children?.length) {
    return { size: node.Size || 0, progressSum: node.Progress || 0, count: 1 };
  }

  const stats = node.children.map(calculateDirStats);
  const totalSize = stats.reduce((sum, s) => sum + s.size, 0);
  const totalProgressSum = stats.reduce(
    (sum, s) => sum + s.progressSum * s.count,
    0
  );
  const totalCount = stats.reduce((sum, s) => sum + s.count, 0);

  node.Size = totalSize;
  node.Progress = totalCount > 0 ? totalProgressSum / totalCount : 0;

  return { size: totalSize, progressSum: node.Progress, count: totalCount };
};

const buildFileTree = (files: TorrentFile[]): FileNode[] => {
  const root: { [path: string]: FileNode } = {};

  // Сначала сортируем файлы для более логичного отображения
  const sortedFiles = [...files].sort((a, b) => a.Path.localeCompare(b.Path));

  // Создаем узлы дерева для всех файлов и директорий
  sortedFiles.forEach((file) => {
    const pathParts = file.Path.split("/");
    let fullPath = "";

    // Создаем цепочку директорий для каждого файла
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const isLastPart = i === pathParts.length - 1;

      fullPath = fullPath ? `${fullPath}/${part}` : part;

      if (!root[fullPath]) {
        // Создаем узел для директории или файла
        const node = createNodeForPath(file, part, fullPath, isLastPart);
        root[fullPath] = node;

        // Добавляем узел к родительскому узлу, если это не корневой узел
        if (i > 0) {
          const parentPath = pathParts.slice(0, i).join("/");
          addNodeToParent(root, node, parentPath);
        }
      } else if (isLastPart) {
        // Если узел уже существует, но это конечный файл, обновляем его свойства
        const node = root[fullPath];
        node.ID = file.ID;
        node.Size = file.Size;
        node.Progress = file.Progress;
        node.Wanted = file.Wanted;
        node.isDirectory = false;
        node.children = undefined;
      }
    }
  });

  // Получаем только корневые узлы
  const rootNodes = Object.values(root).filter((node) => {
    const parentPath = node.Path.split("/").slice(0, -1).join("/");
    return parentPath === "" || !root[parentPath];
  });

  // Вычисляем статистику для всех директорий
  rootNodes.forEach(calculateDirStats);

  return rootNodes;
};

export const TorrentContent: React.FC<TorrentContentProps> = ({
  id,
  name,
  onClose,
}) => {
  const { t } = useLocalization();
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allChecked, setAllChecked] = useState(true);
  const [indeterminate, setIndeterminate] = useState(false);

  const updateAllCheckedState = (nodes: FileNode[]): void => {
    let allWanted = true;
    let anyWanted = false;

    const checkNode = (node: FileNode): void => {
      if (!node.children) {
        if (node.Wanted) anyWanted = true;
        else allWanted = false;
        return;
      }
      node.children.forEach(checkNode);
    };

    nodes.forEach(checkNode);
    setAllChecked(allWanted);
    setIndeterminate(anyWanted && !allWanted);
  };

  const toggleNode = async (node: FileNode, wanted: boolean): Promise<void> => {
    const fileIds = collectFileIds(node);

    if (fileIds.length > 0) {
      try {
        await SetFilesWanted(id, fileIds, wanted);
        setFileTree((prev: FileNode[]) => {
          const newTree = updateNodesWanted(prev, node, wanted, fileIds);
          updateAllCheckedState(newTree);
          return newTree;
        });
      } catch (err) {
        console.error("Failed to update file state:", err);
        setError(t("errors.failedToUpdateFile", String(err)));
      }
    }
  };

  const toggleExpand = (node: FileNode) => {
    const toggleNodeExpanded = (nodes: FileNode[]): FileNode[] => {
      return nodes.map((n) => {
        if (n === node) {
          return { ...n, expanded: !n.expanded };
        }
        if (n.children) {
          return { ...n, children: toggleNodeExpanded(n.children) };
        }
        return n;
      });
    };

    setFileTree((prev: FileNode[]) => toggleNodeExpanded(prev));
  };

  const toggleAll = async () => {
    const newWanted = indeterminate || !allChecked;
    const allFiles: number[] = [];

    const collectAllFiles = (nodes: FileNode[]) => {
      nodes.forEach((node) => {
        if (!node.isDirectory && node.ID >= 0) {
          allFiles.push(node.ID);
        } else if (node.children) {
          collectAllFiles(node.children);
        }
      });
    };

    collectAllFiles(fileTree);

    try {
      await SetFilesWanted(id, allFiles, newWanted);
      const updateAllNodes = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => ({
          ...node,
          Wanted: newWanted,
          children: node.children ? updateAllNodes(node.children) : undefined,
        }));
      };

      setFileTree((prev) => {
        const newTree = updateAllNodes(prev);
        setAllChecked(newWanted);
        setIndeterminate(false);
        return newTree;
      });
    } catch (err) {
      console.error("Failed to update files:", err);
      setError(t("errors.failedToUpdateFiles", String(err)));
    }
  };

  const renderFileNode = (node: FileNode, depth: number = 0) => {
    return (
      <FileNodeContainer
        key={node.Path}
        depth={depth}
        isDirectory={!!node.isDirectory}
      >
        <FileNodeContent isDirectory={!!node.isDirectory}>
          {node.isDirectory ? (
            <ExpandButton
              isExpanded={!!node.expanded}
              onClick={() => toggleExpand(node)}
              aria-label={node.expanded ? "Свернуть" : "Развернуть"}
            >
              <ChevronDownIcon />
            </ExpandButton>
          ) : (
            <div style={{ width: "24px" }} />
          )}

          <IconWrapper isDirectory={!!node.isDirectory}>
            {node.isDirectory ? <FolderIcon /> : <DocumentIcon />}
          </IconWrapper>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Checkbox
              type="checkbox"
              checked={node.Wanted}
              onChange={(e) => toggleNode(node, e.target.checked)}
            />
            <FileName title={node.Name}>{node.Name}</FileName>
          </div>

          <FileProgress
            progress={node.Progress ?? 0}
            title={`${(node.Progress ?? 0).toFixed(1)}%`}
          />
          <FileSize>{formatFileSize(node.Size)}</FileSize>
        </FileNodeContent>

        {node.isDirectory && node.children && (
          <FileChildren isExpanded={!!node.expanded}>
            {node.children.map((child) => renderFileNode(child, depth + 1))}
          </FileChildren>
        )}
      </FileNodeContainer>
    );
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className={styles["loading-container"]}>
          <ArrowPathIcon className={styles["loading-spinner"]} />
          <div className={styles["loading-text"]}>
            {t("torrent.loadingFiles")}
          </div>
        </div>
      );
    }

    if (error) {
      return <div className={styles["error-message"]}>{error}</div>;
    }

    return (
      <div>
        <SelectAllContainer>
          <Checkbox
            type="checkbox"
            checked={allChecked}
            ref={(el) => {
              if (el) {
                el.indeterminate = indeterminate;
              }
            }}
            onChange={toggleAll}
          />
          <SelectAllLabel>{t("torrent.selectAll")}</SelectAllLabel>
        </SelectAllContainer>
        <FileTree>{fileTree.map((node) => renderFileNode(node))}</FileTree>
      </div>
    );
  };

  useEffect(() => {
    const loadFiles = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await GetTorrentFiles(id);
        const tree = buildFileTree(data);
        setFileTree(tree);
        updateAllCheckedState(tree);
      } catch (err) {
        console.error("Failed to load torrent files:", err);
        setError(t("errors.failedToLoadFiles", String(err)));
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [id]);

  return (
    <Container>
      <Header>
        <Title>{name}</Title>
        <CloseButton onClick={onClose} aria-label={t("common.close")}>
          <XMarkIcon />
        </CloseButton>
      </Header>
      <Content>{renderContent()}</Content>
    </Container>
  );
};
