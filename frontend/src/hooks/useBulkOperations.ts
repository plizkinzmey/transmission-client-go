import { useState, useEffect } from "react";
import { TorrentData } from "../components/TorrentList";
import { useLocalization } from "../contexts/LocalizationContext";
import {
  StartTorrents,
  StopTorrents,
  RemoveTorrent,
  SetTorrentSpeedLimit,
} from "../../wailsjs/go/main/App";

interface BulkOperationsState {
  start: boolean;
  stop: boolean;
  remove: boolean;
  speedLimit: boolean;
}

interface Config {
  slowSpeedLimit: number;
  slowSpeedUnit: "KiB/s" | "MiB/s";
}

/**
 * Хук для управления массовыми операциями запуска и остановки торрентов
 * Отслеживает состояние операций и изменения состояний торрентов
 */
export function useBulkOperations(
  torrents: TorrentData[],
  selectedTorrents: Set<number>,
  refreshTorrents: () => Promise<void>,
  config: Config | undefined
) {
  const { t } = useLocalization();
  const [bulkOperations, setBulkOperations] = useState<BulkOperationsState>({
    start: false,
    stop: false,
    remove: false,
    speedLimit: false,
  });
  const [lastBulkAction, setLastBulkAction] = useState<
    "start" | "stop" | "remove" | "speedLimit" | null
  >(null);
  const [lastTorrentStates, setLastTorrentStates] = useState<
    Map<number, string>
  >(new Map());
  const [error, setError] = useState<string | null>(null);

  // Эффект для отслеживания выполнения массовых операций
  useEffect(() => {
    if (!lastBulkAction || !(bulkOperations.start || bulkOperations.stop))
      return;

    const selectedTorrentsArray = Array.from(selectedTorrents);

    // Проверяем, есть ли торренты, которые можно обработать
    const hasTorrentsToProcess = selectedTorrentsArray.some((id) => {
      const torrent = torrents.find((t) => t.ID === id);
      if (!torrent) return false;

      if (lastBulkAction === "start") {
        return torrent.Status === "stopped";
      } else {
        return torrent.Status === "downloading" || torrent.Status === "seeding";
      }
    });

    // Если нет торрентов для обработки, отменяем операцию
    if (!hasTorrentsToProcess) {
      setBulkOperations((prev) => ({
        ...prev,
        [lastBulkAction]: false,
      }));
      setLastBulkAction(null);
      setLastTorrentStates(new Map());
      return;
    }

    // Проверяем изменение состояний торрентов
    const allTorrentsChanged = selectedTorrentsArray.every((id) => {
      const torrent = torrents.find((t) => t.ID === id);
      const previousState = lastTorrentStates.get(id);

      if (!torrent || !previousState) return false;

      // Торрент уже был в целевом состоянии
      const wasAlreadyInTargetState =
        (lastBulkAction === "start" &&
          (previousState === "downloading" || previousState === "seeding")) ||
        (lastBulkAction === "stop" && previousState === "stopped");

      if (wasAlreadyInTargetState) return true;

      // Проверяем, изменилось ли состояние на целевое
      if (lastBulkAction === "start") {
        return (
          previousState !== torrent.Status &&
          (torrent.Status === "downloading" || torrent.Status === "seeding")
        );
      } else {
        return previousState !== torrent.Status && torrent.Status === "stopped";
      }
    });

    if (allTorrentsChanged) {
      setBulkOperations((prev) => ({
        ...prev,
        [lastBulkAction]: false,
      }));
      setLastBulkAction(null);
      setLastTorrentStates(new Map());
    }
  }, [
    torrents,
    selectedTorrents,
    bulkOperations,
    lastBulkAction,
    lastTorrentStates,
  ]);

  // Обработчик запуска выбранных торрентов
  const handleStartSelected = async () => {
    if (bulkOperations.start || selectedTorrents.size === 0) return;

    const torrentsToStart = torrents.filter(
      (t) =>
        selectedTorrents.has(t.ID) &&
        (t.Status === "stopped" || t.Status === "completed")
    );

    if (torrentsToStart.length === 0) return;

    const states = new Map(
      torrents
        .filter((t) => selectedTorrents.has(t.ID))
        .map((t) => [t.ID, t.Status])
    );

    setBulkOperations((prev) => ({ ...prev, start: true }));
    setLastBulkAction("start");
    setLastTorrentStates(states);

    try {
      // Преобразуем в массив int64
      const idsToStart = torrentsToStart.map((t) => Number(t.ID));
      console.log("Starting torrents with IDs:", idsToStart);

      await StartTorrents(idsToStart);
      await refreshTorrents();
    } catch (error) {
      console.error("Failed to start torrents:", error);
      setError(t("errors.failedToStartTorrents", String(error)));
      setBulkOperations((prev) => ({ ...prev, start: false }));
      setLastBulkAction(null);
      setLastTorrentStates(new Map());
    }
  };

  // Обработчик остановки выбранных торрентов
  const handleStopSelected = async () => {
    if (bulkOperations.stop || selectedTorrents.size === 0) return;

    const torrentsToStop = torrents.filter(
      (t) =>
        selectedTorrents.has(t.ID) &&
        (t.Status === "downloading" || t.Status === "seeding")
    );

    if (torrentsToStop.length === 0) return;

    const states = new Map(
      torrents
        .filter((t) => selectedTorrents.has(t.ID))
        .map((t) => [t.ID, t.Status])
    );

    setBulkOperations((prev) => ({ ...prev, stop: true }));
    setLastBulkAction("stop");
    setLastTorrentStates(states);

    try {
      // Преобразуем в массив int64
      const idsToStop = torrentsToStop.map((t) => Number(t.ID));
      console.log("Stopping torrents with IDs:", idsToStop);

      await StopTorrents(idsToStop);
      await refreshTorrents();
    } catch (error) {
      console.error("Failed to stop torrents:", error);
      setError(t("errors.failedToStopTorrents", String(error)));
      setBulkOperations((prev) => ({ ...prev, stop: false }));
      setLastBulkAction(null);
      setLastTorrentStates(new Map());
    }
  };

  // Обработчик удаления выбранных торрентов
  const handleRemoveSelected = async (deleteData: boolean = false) => {
    if (bulkOperations.remove || selectedTorrents.size === 0) return;

    setBulkOperations((prev) => ({ ...prev, remove: true }));

    try {
      console.log(
        `Removing ${selectedTorrents.size} torrents, deleteData: ${deleteData}`
      );

      // Обрабатываем торренты последовательно
      for (const id of Array.from(selectedTorrents)) {
        try {
          console.log(`Removing torrent ID: ${id}, deleteData: ${deleteData}`);
          await RemoveTorrent(Number(id), deleteData);
        } catch (error) {
          console.error(`Failed to remove torrent ${id}:`, error);
        }
      }

      // Обновляем список торрентов
      await refreshTorrents();
    } catch (error) {
      console.error("Error in bulk remove operation:", error);
      setError(t("errors.failedToRemoveTorrents", String(error)));
    } finally {
      setBulkOperations((prev) => ({ ...prev, remove: false }));
    }
  };

  // Обработчик установки ограничения скорости для выбранных торрентов
  const handleSetSpeedLimit = async (isSlowMode: boolean) => {
    if (bulkOperations.speedLimit || selectedTorrents.size === 0 || !config)
      return;

    setBulkOperations((prev) => ({ ...prev, speedLimit: true }));

    try {
      console.log(
        `Setting speed limit (slow mode: ${isSlowMode}) for ${selectedTorrents.size} torrents`
      );

      // Получаем IDs выбранных торрентов
      const selectedIds = Array.from(selectedTorrents).map(Number);

      // Применяем ограничение скорости
      await SetTorrentSpeedLimit(selectedIds, isSlowMode);

      // Обновляем список торрентов для отображения изменений
      await refreshTorrents();
    } catch (error) {
      console.error("Failed to set speed limit:", error);
      setError(t("errors.failedToSetSpeedLimit", String(error)));
    } finally {
      setBulkOperations((prev) => ({ ...prev, speedLimit: false }));
    }
  };

  return {
    bulkOperations,
    error,
    handleStartSelected,
    handleStopSelected,
    handleRemoveSelected,
    handleSetSpeedLimit,
  };
}
