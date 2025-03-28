import { useEffect, useState } from "react";
import {
  Card,
  Flex,
  Box,
  Text,
  Progress,
  Checkbox,
  IconButton,
  Badge,
} from "@radix-ui/themes";
import { DeleteDialog } from "./DeleteDialog";
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
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { SnailIcon } from "./icons/SnailIcon";
import styles from "../styles/TorrentItem.module.css";

interface TorrentItemProps {
  id: number;
  name: string;
  status: string;
  progress: number;
  sizeFormatted: string;
  uploadRatio: number;
  seedsConnected: number;
  seedsTotal: number;
  peersConnected: number;
  peersTotal: number;
  uploadedFormatted: string;
  selected: boolean;
  onSelect: (id: number) => void;
  onRemove: (id: number, deleteData: boolean) => void;
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  onVerify?: (id: number) => void;
  downloadSpeedFormatted: string;
  uploadSpeedFormatted: string;
  onSetSpeedLimit?: (id: number, isSlowMode: boolean) => void;
  isSlowMode?: boolean;
}

type StatusType =
  | "downloading"
  | "seeding"
  | "stopped"
  | "completed"
  | "checking"
  | "queued";
type ColorType =
  | "blue"
  | "grass"
  | "gray"
  | "amber"
  | "purple"
  | "mint"
  | "tomato";

export const TorrentItem: React.FC<TorrentItemProps> = ({
  id,
  name,
  status,
  progress,
  sizeFormatted,
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
  onVerify,
  downloadSpeedFormatted,
  uploadSpeedFormatted,
  onSetSpeedLimit,
  isSlowMode = false,
}) => {
  const { t } = useLocalization();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastAction, setLastAction] = useState<"start" | "stop" | "verify" | null>(null);
  const [lastStatus, setLastStatus] = useState(status);

  const isRunning = ["downloading", "seeding"].includes(status);
  const isChecking = status === "checking";

  // Сбрасываем состояние верификации, когда статус изменился с "checking" на любой другой
  useEffect(() => {
    // Если статус изменился с checking на любой другой - верификация завершена
    if (isVerifying && status !== "checking") {
      setIsVerifying(false);
      setLastAction(null);
    }

    // Если статус стал checking и последнее действие было verify - устанавливаем флаг верификации
    if (!isVerifying && status === "checking" && lastAction === "verify") {
      setIsVerifying(true);
      setIsLoading(false);
    }

    setLastStatus(status);
  }, [status, isVerifying, lastAction]);

  // Обработка действий с торрентом (старт, стоп, проверка)
  useEffect(() => {
    if (!isLoading || !lastAction) return;

    // Если действие не verify, то обрабатываем как обычно
    if (lastAction !== "verify") {
      const canPerformAction =
        (lastAction === "start" && status === "stopped") ||
        (lastAction === "stop" && ["downloading", "seeding"].includes(status));
      
      if (!canPerformAction) {
        setIsLoading(false);
        setLastAction(null);
        return;
      }

      if (lastStatus !== status) {
        const isActionComplete =
          (lastAction === "start" && ["downloading", "seeding"].includes(status)) ||
          (lastAction === "stop" && status === "stopped");

        if (isActionComplete) {
          setIsLoading(false);
          setLastAction(null);
        }
      }
    } else {
      // Для верификации ждем когда статус станет checking
      if (status === "checking") {
        setIsLoading(false);
      }
    }
  }, [status, lastAction, lastStatus, isLoading]);

  const handleAction = (action: "start" | "stop" | "verify") => {
    if (isVerifying && action !== "verify") return; // Блокируем другие действия во время верификации
    
    setIsLoading(true);
    setLastAction(action);

    if (action === "start") {
      onStart(id);
    } else if (action === "stop") {
      onStop(id);
    } else if (action === "verify" && onVerify) {
      onVerify(id);
    }
  };

  const normalizeValue = (value: number): number => (value < 0 ? 0 : value);

  const getStatusData = (
    status: string
  ): { text: string; color: ColorType } => {
    const statusMap: Record<StatusType, { color: ColorType }> = {
      downloading: { color: "blue" },
      seeding: { color: "grass" },
      completed: { color: "mint" },
      checking: { color: "amber" },
      queued: { color: "purple" },
      stopped: { color: "gray" },
    };

    return {
      text: t(`torrent.status.${status}`),
      color: statusMap[status as StatusType]?.color || "gray",
    };
  };

  const getCardClassName = (): string => {
    const statusCapitalized = status.charAt(0).toUpperCase() + status.slice(1);
    const statusClassName = "card" + statusCapitalized;
    return `${styles.card} ${styles[statusClassName]}`;
  };

  const renderActionButton = () => {
    if (isLoading && lastAction !== "verify") {
      return (
        <IconButton disabled variant="soft" color="gray">
          <LoadingSpinner size="small" />
        </IconButton>
      );
    }

    if (isRunning) {
      return (
        <IconButton
          size="2"
          variant="solid"
          color="amber"
          onClick={() => handleAction("stop")}
          title={t("torrent.stop")}
          disabled={isVerifying}
        >
          <PauseIcon width={16} height={16} />
        </IconButton>
      );
    }

    return (
      <IconButton
        size="2"
        variant="soft"
        color="grass"
        onClick={() => handleAction("start")}
        title={t("torrent.start")}
        disabled={isVerifying || isChecking}
      >
        <PlayIcon width={16} height={16} />
      </IconButton>
    );
  };

  const renderVerifyButton = () => {
    if (!onVerify) return null;

    if (isVerifying) {
      return (
        <IconButton
          size="2"
          variant="solid"
          color="amber"
          disabled
          title={t("torrent.verifying")}
        >
          <LoadingSpinner size="small" />
        </IconButton>
      );
    }

    return (
      <IconButton
        size="2"
        variant="soft"
        color="orange"
        onClick={() => handleAction("verify")}
        title={t("torrent.verify")}
        disabled={isChecking || isLoading}
      >
        <CheckCircleIcon width={16} height={16} />
      </IconButton>
    );
  };

  const renderSpeedLimitButton = () => {
    if (!onSetSpeedLimit) return null;

    return (
      <IconButton
        size="2"
        variant={isSlowMode ? "solid" : "soft"}
        color={isSlowMode ? "orange" : "blue"}
        onClick={() => onSetSpeedLimit(id, !isSlowMode)}
        title={t(isSlowMode ? "torrent.normalSpeed" : "torrent.slowSpeed")}
        disabled={isVerifying}
      >
        <SnailIcon style={{ width: 16, height: 16 }} />
      </IconButton>
    );
  };

  const renderTorrentInfo = () => {
    const { color } = getStatusData(status);

    return (
      <Box className={styles.contentBox}>
        <Flex justify="between" align="start" mb="2">
          <Text
            as="span"
            size="2"
            weight="medium"
            className={styles.textEllipsis}
            title={name}
          >
            {name}
          </Text>
          <Badge variant="surface" size="1" title={t("torrent.uploadRatio")}>
            {t("torrent.ratio")}: {normalizeValue(uploadRatio).toFixed(2)}
          </Badge>
        </Flex>

        <Flex gap="2" align="center" mb="2">
          <Badge variant="soft" size="1" color={color}>
            {t(`torrent.status.${status}`)}
          </Badge>
          <Text size="1">{progress.toFixed(1)}%</Text>
        </Flex>

        {isVerifying || isChecking ? (
          <Box className={styles.verificationProgress}>
            <Progress
              size="1"
              variant="surface"
              value={progress}
              className={styles.progressWrapper}
              color="amber"
              style={{ 
                animation: 'pulse 1.5s infinite ease-in-out',
                background: 'rgba(255, 214, 0, 0.15)' 
              }}
            />
            <Text size="1" style={{ marginTop: '4px', color: 'var(--amber-9)', textAlign: 'center' }}>
              {t("torrent.verifying")}...
            </Text>
          </Box>
        ) : (
          <Progress
            size="1"
            variant="surface"
            value={progress}
            className={styles.progressWrapper}
            color={color}
          />
        )}

        {renderStats()}
      </Box>
    );
  };

  const renderStats = () => (
    <Flex wrap="wrap" gap="3" justify="between">
      <Flex wrap="wrap" gap="3">
        {renderStatItem("size", sizeFormatted)}
        {renderStatItem(
          "seeds",
          `${normalizeValue(seedsConnected)}/${normalizeValue(seedsTotal)}`
        )}
        {renderStatItem(
          "peers",
          `${normalizeValue(peersConnected)}/${normalizeValue(peersTotal)}`
        )}
        {renderStatItem("uploaded", uploadedFormatted)}
      </Flex>

      <Flex justify="between" gap="3" align="center">
        {renderSpeedInfo()}
        {renderActions()}
      </Flex>
    </Flex>
  );

  const renderStatItem = (label: string, value: string) => (
    <Flex gap="1" align="center">
      <Text size="1" weight="medium">
        {t(`torrent.${label}`)}:
      </Text>
      <Text size="1">{value}</Text>
    </Flex>
  );

  const renderSpeedInfo = () => (
    <Flex gap="1" align="center">
      <ArrowDownIcon width={16} height={16} className={styles.downloadIcon} />
      <Text size="1">{downloadSpeedFormatted}</Text>
      <ArrowUpIcon width={16} height={16} className={styles.uploadIcon} />
      <Text size="1">{uploadSpeedFormatted}</Text>
    </Flex>
  );

  const renderActions = () => (
    <Flex className={styles.actions}>
      <IconButton
        size="2"
        variant="soft"
        color="indigo"
        onClick={() => setShowContent(true)}
        title={t("torrent.viewContent")}
        disabled={isVerifying}
      >
        <FolderIcon width={16} height={16} />
      </IconButton>

      {renderActionButton()}
      {renderSpeedLimitButton()}
      {renderVerifyButton()}

      <IconButton
        size="2"
        variant="soft"
        color="red"
        onClick={() => setShowDeleteConfirmation(true)}
        title={t("torrent.remove")}
        disabled={isVerifying}
      >
        <TrashIcon width={16} height={16} />
      </IconButton>
    </Flex>
  );

  return (
    <>
      <Card variant="surface" className={getCardClassName()}>
        <Flex gap="3" align="start">
          <Box pt="1">
            <Checkbox
              size="1"
              checked={selected}
              onCheckedChange={() => onSelect(id)}
              aria-label={t("torrents.selectTorrent", name)}
              disabled={isVerifying}
            />
          </Box>
          {renderTorrentInfo()}
        </Flex>
      </Card>

      <DeleteDialog
        mode="single"
        torrentName={name}
        onConfirm={(deleteData) => {
          onRemove(id, deleteData);
          setShowDeleteConfirmation(false);
        }}
        onCancel={() => setShowDeleteConfirmation(false)}
        open={showDeleteConfirmation}
      />

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
