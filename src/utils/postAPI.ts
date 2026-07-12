
import api from "./api";

export const postAPI = {
    async deletePost(id: string): Promise<void> {
        await api.delete(`/posts/${id}`);
    }  
};