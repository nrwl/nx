import { useState, useCallback } from 'react';

function useMapState<K, V>(initialMap: Map<K, V> = new Map()) {
  const [map, setMap] = useState(new Map(initialMap));

  // Function to set a key-value pair in the map
  const setKey = useCallback((key: K, value: V) => {
    setMap((prevMap) => {
      const newMap = new Map(prevMap);
      newMap.set(key, value);
      return newMap;
    });
  }, []);

  // Function to get a value by key from the map
  const getKey = useCallback((key: K) => map.get(key), [map]);

  return [getKey, setKey] as const;
}

export default useMapState;
