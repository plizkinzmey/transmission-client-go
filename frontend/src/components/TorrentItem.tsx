import { useEffect, useState } from "react";
import { Button } from "./Button";
import { DeleteConfirmation } from "./DeleteConfirmation";
import { TorrentContent } from "./TorrentContent";
import { LoadingSpinner } from "./LoadingSpinner";
import { useLocalization } from "../contexts/LocalizationContext";
import {
  PlayIcon,
  PauseIcon,
  TrashIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import styles from "../styles/TorrentItem.module.css";

interface TorrentItemProps {
  id: number;
  name: string;
  status: string;
  progress: number;
  size: number;
  sizeFormatted: string;
  uploadRatio: number;
  seedsConnected: number;
  seedsTotal: number;
  peersConnected: number;
  peersTotal: number;
  uploadedBytes: number;
  uploadedFormatted: string;
  selected: boolean;
  onSelect: (id: number) => void;
  onRemove: (id: number, deleteData: boolean) => void;
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  downloadSpeedFormatted: string;
  uploadSpeedFormatted: string;
  onSetSpeedLimit?: (id: number, isSlowMode: boolean) => void;
  isSlowMode?: boolean;
}

const getStatusClassName = (status: string) => {
  switch (status) {
    case "downloading":
      return styles.statusDownloading;
    case "seeding":
      return styles.statusSeeding;
    case "completed":
      return styles.statusCompleted;
    case "checking":
      return styles.statusChecking;
    case "queued":
      return styles.statusQueued;
    default:
      return styles.statusStopped;
  }
};

export const TorrentItem: React.FC<TorrentItemProps> = ({
  id,
  name,
  status,
  progress,
  sizeFormatted, // используем уже отформатированное значение с бэкенда
  uploadRatio,
  seedsConnected,
  seedsTotal,
  peersConnected,
  peersTotal,
  uploadedFormatted,
  selected,
  onSelect,
  onRemove,
  onStart,
  onStop,
  downloadSpeedFormatted,
  uploadSpeedFormatted,
  onSetSpeedLimit,
  isSlowMode = false,
}) => {
  const { t } = useLocalization();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAction, setLastAction] = useState<"start" | "stop" | null>(null);
  const [lastStatus, setLastStatus] = useState(status);

  // Отслеживаем изменение статуса торрента
  useEffect(() => {
    if (isLoading && lastAction) {
      // Проверяем, можно ли выполнить действие
      const canPerformAction =
        (lastAction === "start" && status === "stopped") ||
        (lastAction === "stop" &&
          (status === "downloading" || status === "seeding"));

      // Если действие невозможно выполнить (торрент уже в нужном состоянии)
      if (!canPerformAction) {
        setIsLoading(false);
        setLastAction(null);
        return;
      }

      // Если статус изменился после выполнения действия
      if (lastStatus !== status) {
        if (
          (lastAction === "start" &&
            (status === "downloading" || status === "seeding")) ||
          (lastAction === "stop" && status === "stopped")
        ) {
          setIsLoading(false);
          setLastAction(null);
        }
      }
    }
    setLastStatus(status);
  }, [status, lastAction, lastStatus, isLoading]);

  const handleAction = (action: "start" | "stop") => {
    setIsLoading(true);
    setLastAction(action);
    if (action === "start") {
      onStart(id);
    } else {
      onStop(id);
    }
  };

  const isRunning = status === "downloading" || status === "seeding";

  const renderActionButton = () => {
    if (isLoading) {
      return (
        <Button variant="icon" disabled loading>
          <LoadingSpinner size="small" />
        </Button>
      );
    }

    if (isRunning) {
      return (
        <Button
          variant="icon"
          onClick={() => handleAction("stop")}
          aria-label={t("torrent.stop")}
        >
          <PauseIcon />
        </Button>
      );
    }

    return (
      <Button
        variant="icon"
        onClick={() => handleAction("start")}
        aria-label={t("torrent.start")}
      >
        <PlayIcon />
      </Button>
    );
  };

  const getStatusText = (status: string): string => {
    return t(`torrent.status.${status}`);
  };

  // Используем только нормализацию отрицательных значений
  const normalizeValue = (value: number): number => {
    return value < 0 ? 0 : value;
  };

  return (
    <>
      <div className={styles.container} data-status={status}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onSelect(id)}
            aria-label={t("torrents.selectTorrent", name)}
          />
        </label>

        <div className={styles.info}>
          <div className={styles.topRow}>
            <h3 className={styles.name} title={name}>
              {name}
            </h3>
            <div
              className={styles.ratioContainer}
              title={t("torrent.uploadRatio")}
            >
              <span className={styles.ratio}>
                {t("torrent.ratio")}: {normalizeValue(uploadRatio).toFixed(2)}
              </span>
            </div>
          </div>

          <div className={styles.statusContainer}>
            <span className={getStatusClassName(status)}>
              {getStatusText(status)}
            </span>
            <span className={styles.progressPercentage}>
              {progress.toFixed(1)}%
            </span>
          </div>

          <div className={styles.progressContainer}>
            <progress className={styles.progress} value={progress} max="100" />
          </div>

          <div className={styles.statsContainer}>
            <span className={styles.size} style={{ pointerEvents: "none" }}>
              <span className={styles.paramName}>{t("torrent.size")}:</span>{" "}
              {sizeFormatted}
            </span>
            <span className={styles.speed} style={{ pointerEvents: "none" }}>
              <span className={styles.paramName}>{t("torrent.speed")}:</span>{" "}
              <ArrowDownIcon
                className={`${styles.speedIcon} ${styles.downloadIcon}`}
              />{" "}
              {downloadSpeedFormatted}{" "}
              <ArrowUpIcon
                className={`${styles.speedIcon} ${styles.uploadIcon}`}
              />{" "}
              {uploadSpeedFormatted}
            </span>
            <span className={styles.seeds} style={{ pointerEvents: "none" }}>
              <span className={styles.paramName}>{t("torrent.seeds")}:</span>{" "}
              {normalizeValue(seedsConnected)}/{normalizeValue(seedsTotal)}
            </span>
            <span className={styles.peers} style={{ pointerEvents: "none" }}>
              <span className={styles.paramName}>{t("torrent.peers")}:</span>{" "}
              {normalizeValue(peersConnected)}/{normalizeValue(peersTotal)}
            </span>
            <span className={styles.uploaded} style={{ pointerEvents: "none" }}>
              <span className={styles.paramName}>{t("torrent.uploaded")}:</span>{" "}
              {uploadedFormatted}
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <Button
            variant="icon"
            onClick={() => setShowContent(true)}
            title={t("torrent.viewContent")}
          >
            <FolderIcon className={styles.icon} />
          </Button>
          {renderActionButton()}
          {onSetSpeedLimit && (
            <Button
              onClick={() => onSetSpeedLimit(id, !isSlowMode)}
              title={t(isSlowMode ? "torrent.normalSpeed" : "torrent.slowSpeed")}
              icon="snail"
              active={isSlowMode}
            />
          )}
          <Button
            variant="icon"
            onClick={() => setShowDeleteConfirmation(true)}
            title={t("torrent.remove")}
          >
            <TrashIcon className={styles.icon} />
          </Button>
        </div>
      </div>

      {showDeleteConfirmation && (
        <DeleteConfirmation
          torrentName={name}
          onConfirm={(deleteData) => {
            onRemove(id, deleteData);
            setShowDeleteConfirmation(false);
          }}
          onCancel={() => setShowDeleteConfirmation(false)}
        />
      )}

      {showContent && (
        <TorrentContent
          id={id}
          name={name}
          onClose={() => setShowContent(false)}
        />
      )}
    </>
  );
};
