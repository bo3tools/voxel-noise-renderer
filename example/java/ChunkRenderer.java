package example.renderer;

import java.awt.Color;
import java.io.ByteArrayInputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.CompletableFuture;

public class ChunkRenderer {
    public interface ChunkData {
        int getChunkX();
        int getChunkZ();
        Color getColorAt(int x, int y, int z);
    }

    private final static int CHUNK_SIZE = 16;
    private final static int CHUNK_HEIGHT = 256;
    private final static int CHUNK_DATA_SIZE = 3 * CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT;

    private final String baseUrl;

    @SuppressWarnings("ConstantConditions")
    private HttpURLConnection initializeRequest(String endpointUrl) {
        try {
            HttpURLConnection httpConnection = (HttpURLConnection) new URL(this.baseUrl + endpointUrl).openConnection();
            httpConnection.setRequestMethod("POST");
            httpConnection.setDoOutput(true);
            httpConnection.setDoInput(true);
            return httpConnection;
        }
        catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }

    public ChunkRenderer(String serverHost) {
        this(serverHost, 80);
    }

    public ChunkRenderer(String serverHost, int serverPort) {
        this.baseUrl = "http://" + serverHost + ":" + serverPort;
    }

    public CompletableFuture<Void> sendChunkData(ChunkData chunk) {
        final int chunkX = chunk.getChunkX();
        final int chunkZ = chunk.getChunkZ();

        return CompletableFuture.runAsync(() -> {
            byte[] chunkData = new byte[CHUNK_DATA_SIZE];
            int i = 0;

            for (int x = 0; x < CHUNK_SIZE; x++) {
                for (int z = 0; z < CHUNK_SIZE; z++) {
                    for (int y = 0; y < CHUNK_HEIGHT; y++) {
                        Color blockColor = chunk.getColorAt(x, y, z);
                        chunkData[i++] = (byte) blockColor.getRed();
                        chunkData[i++] = (byte) blockColor.getGreen();
                        chunkData[i++] = (byte) blockColor.getBlue();
                    }
                }
            }

            if (i != CHUNK_DATA_SIZE) {
                throw new IllegalStateException("Chunk data index " + i + " must be equal to " + CHUNK_DATA_SIZE + " after initialization");
            }

            ByteArrayInputStream chunkDataStream = new ByteArrayInputStream(chunkData);

            HttpURLConnection httpConnection = initializeRequest("/api/set-chunk?x=" + chunkX + "&z=" + chunkZ);
            httpConnection.setRequestProperty("Content-Type", "application/octet-stream");
            httpConnection.setChunkedStreamingMode(0);

            try (OutputStream out = httpConnection.getOutputStream()) {
                byte[] buffer = new byte[2048];
                for (int n = 0; n >= 0; n = chunkDataStream.read(buffer)) {
                    out.write(buffer, 0, n);
                }
            }
            catch (Exception e) {
                e.printStackTrace();
            }
        });
    }
}
