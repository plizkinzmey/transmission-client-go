import { useState, useEffect } from 'react';
import { Button } from './components/Button';
import { TorrentItem } from './components/TorrentItem';
import { Settings } from './components/Settings';
import { AddTorrent } from './components/AddTorrent';
import {
  Cog6ToothIcon,
  PlusCircleIcon,
  PlayIcon,
  PauseIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import styles from './styles/App.module.css';
import './App.css';

import { 
  GetTorrents, 
  AddTorrent as AddTorrentAPI, 
  AddTorrentFile, 
  RemoveTorrent, 
  Initialize, 
  LoadConfig,
  StartTorrents,
  StopTorrents
} from '../wailsjs/go/main/App';

interface Torrent {
  ID: number;
  Name: string;
  Status: string;
  Progress: number;
}

interface Config {
  host: string;
  port: number;
  username: string;
  password: string;
}

function App() {
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [selectedTorrents, setSelectedTorrents] = useState<Set<number>>(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTorrent, setShowAddTorrent] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 3;
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const handleSelectAll = () => {
    if (selectedTorrents.size === filteredTorrents.length) {
      // Если все выбраны - снимаем выделение
      setSelectedTorrents(new Set());
    } else {
      // Иначе выбираем все
      setSelectedTorrents(new Set(filteredTorrents.map(t => t.ID)));
    }
  };

  // Функция переподключения к серверу
  const reconnect = async () => {
    if (reconnectAttempts >= maxReconnectAttempts) {
      setError('Maximum reconnection attempts reached. Please check your connection settings.');
      setIsReconnecting(false);
      return;
    }

    setIsReconnecting(true);
    try {
      const savedConfig = await LoadConfig();
      if (savedConfig) {
        await Initialize(JSON.stringify(savedConfig));
        setError(null);
        setIsReconnecting(false);
        setReconnectAttempts(0);
        return true;
      }
    } catch (error) {
      console.error('Reconnection attempt failed:', error);
      setReconnectAttempts(prev => prev + 1);
      return false;
    }
  };

  // Функция обновления списка торрентов
  const refreshTorrents = async () => {
    try {
      const response = await GetTorrents();
      setTorrents(response);
      
      // Сбрасываем ошибки и счетчик попыток переподключения при успешном запросе
      setError(null);
      setReconnectAttempts(0);
      setIsReconnecting(false);
    } catch (error) {
      console.error('Failed to fetch torrents:', error);
      
      // Если это ошибка соединения, пытаемся переподключиться
      if (!isReconnecting) {
        setError(`Connection lost. Attempting to reconnect... (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
        const reconnected = await reconnect();
        if (!reconnected) {
          setError(`Failed to reconnect. Retrying in 3 seconds... (${reconnectAttempts + 1}/${maxReconnectAttempts})`);
        }
      }
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Загружаем сохраненные настройки
        const savedConfig = await LoadConfig();
        
        if (savedConfig) {
          try {
            // Если есть сохраненные настройки, используем их
            await Initialize(JSON.stringify(savedConfig));
            setIsInitialized(true);
            refreshTorrents(); // Первоначальная загрузка
          } catch (initError) {
            console.error('Failed to connect with saved settings:', initError);
            setError(`Connection failed: ${initError}. Please check your settings.`);
            setShowSettings(true);
          }
        } else {
          setShowSettings(true);
        }
      } catch (error) {
        console.error('Failed to load config:', error);
        setError(`Failed to load configuration: ${error}`);
        setShowSettings(true);
      }
    };

    initializeApp();
  }, []);

  // Эффект для автоматического обновления списка торрентов
  useEffect(() => {
    let intervalId: number;

    if (isInitialized) {
      // Запускаем первоначальное обновление
      refreshTorrents();

      // Устанавливаем интервал обновления каждые 3 секунды
      intervalId = window.setInterval(refreshTorrents, 3000);
    }

    // Очистка при размонтировании
    return () => {
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [isInitialized]);

  const handleAddTorrent = async (url: string) => {
    try {
      await AddTorrentAPI(url);
      refreshTorrents();
    } catch (error) {
      console.error('Failed to add torrent:', error);
      setError(`Failed to add torrent: ${error}`);
    }
  };

  const handleAddTorrentFile = async (base64Content: string) => {
    try {
      await AddTorrentFile(base64Content);
      refreshTorrents();
    } catch (error) {
      console.error('Failed to add torrent file:', error);
      setError(`Failed to add torrent file: ${error}`);
    }
  };

  const handleRemoveTorrent = async (id: number, deleteData: boolean) => {
    try {
      await RemoveTorrent(id, deleteData);
      refreshTorrents();
    } catch (error) {
      console.error('Failed to remove torrent:', error);
      setError(`Failed to remove torrent: ${error}`);
    }
  };

  const handleSettingsSave = async (settings: Config) => {
    try {
      await Initialize(JSON.stringify(settings));
      setShowSettings(false);
      setIsInitialized(true);
      setError(null); // Сбрасываем ошибки при успешном сохранении настроек
      refreshTorrents();
    } catch (error) {
      console.error('Failed to update settings:', error);
      setError(`Failed to connect with new settings: ${error}`);
      // Оставляем окно настроек открытым в случае ошибки
    }
  };

  const handleTorrentSelect = (id: number) => {
    setSelectedTorrents(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStartSelected = async () => {
    if (isBulkLoading || !hasSelectedTorrents) return;
    
    setIsBulkLoading(true);
    try {
      await StartTorrents(Array.from(selectedTorrents));
      refreshTorrents();
    } catch (error) {
      console.error('Failed to start torrents:', error);
      setError(`Failed to start torrents: ${error}`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleStopSelected = async () => {
    if (isBulkLoading || !hasSelectedTorrents) return;

    setIsBulkLoading(true);
    try {
      await StopTorrents(Array.from(selectedTorrents));
      refreshTorrents();
    } catch (error) {
      console.error('Failed to stop torrents:', error);
      setError(`Failed to stop torrents: ${error}`);
    } finally {
      setIsBulkLoading(false);
    }
  };

  const handleStartTorrent = async (id: number) => {
    try {
      await StartTorrents([id]);
      refreshTorrents();
    } catch (error) {
      console.error('Failed to start torrent:', error);
      setError(`Failed to start torrent: ${error}`);
    }
  };

  const handleStopTorrent = async (id: number) => {
    try {
      await StopTorrents([id]);
      refreshTorrents();
    } catch (error) {
      console.error('Failed to stop torrent:', error);
      setError(`Failed to stop torrent: ${error}`);
    }
  };

  const filteredTorrents = torrents.filter(torrent =>
    torrent.Name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasSelectedTorrents = selectedTorrents.size > 0;

  return (
    <div className={styles.appContainer}>
      <div className={styles.content}>
        <div className={styles.controlPanel}>
          <div className={styles.searchContainer}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search torrents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className={styles.actions}>
            <Button 
              variant="icon"
              onClick={() => setShowSettings(true)}
              aria-label="Settings"
            >
              <Cog6ToothIcon />
            </Button>
            <Button 
              variant="icon"
              onClick={() => setShowAddTorrent(true)}
              aria-label="Add torrent"
            >
              <PlusCircleIcon />
            </Button>
          </div>
        </div>

        {error && (
          <div className={styles.errorMessage}>
            {error}
          </div>
        )}

        {filteredTorrents.length > 0 && (
          <div className={styles.bulkActions}>
            <div className={styles.selectAllContainer}>
              <input
                type="checkbox"
                className={styles.selectAllCheckbox}
                checked={selectedTorrents.size > 0 && selectedTorrents.size === filteredTorrents.length}
                onChange={handleSelectAll}
              />
              <span className={styles.selectAllLabel}>
                Select All ({selectedTorrents.size}/{filteredTorrents.length})
              </span>
            </div>
            <div className={styles.bulkActionButtons}>
              {isBulkLoading ? (
                <Button 
                  variant="icon"
                  disabled
                  loading
                >
                  <ArrowPathIcon className="loading-spinner" />
                </Button>
              ) : (
                <>
                  <Button 
                    variant="icon"
                    onClick={handleStartSelected}
                    disabled={!hasSelectedTorrents}
                    aria-label="Start selected torrents"
                  >
                    <PlayIcon />
                  </Button>
                  <Button 
                    variant="icon"
                    onClick={handleStopSelected}
                    disabled={!hasSelectedTorrents}
                    aria-label="Stop selected torrents"
                  >
                    <PauseIcon />
                  </Button>
                </>
              )}
            </div>
            {isReconnecting && <div className={styles.reconnectingStatus}>Reconnecting...</div>}
          </div>
        )}

        <div className={styles.torrentList}>
          {filteredTorrents.length > 0 ? (
            filteredTorrents.map((torrent) => (
              <TorrentItem
                key={torrent.ID}
                id={torrent.ID}
                name={torrent.Name}
                status={torrent.Status}
                progress={torrent.Progress}
                selected={selectedTorrents.has(torrent.ID)}
                onSelect={handleTorrentSelect}
                onRemove={handleRemoveTorrent}
                onStart={handleStartTorrent}
                onStop={handleStopTorrent}
              />
            ))
          ) : (
            <div className={styles.noTorrents}>
              {searchTerm ? 'No torrents found matching your search' : 'No torrents added yet'}
            </div>
          )}
        </div>

        {showSettings && (
          <Settings
            onSave={handleSettingsSave}
            onClose={() => {
              if (isInitialized) {
                setShowSettings(false);
              }
            }}
          />
        )}

        {showAddTorrent && (
          <AddTorrent
            onAdd={handleAddTorrent}
            onAddFile={handleAddTorrentFile}
            onClose={() => setShowAddTorrent(false)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
